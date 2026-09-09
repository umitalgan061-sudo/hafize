import assert from 'node:assert/strict';
import { createAgentDelegator } from '../lib/agent-delegation.mjs';
import { createAgentLifecycle } from '../lib/agent-lifecycle.mjs';

const registry = { policy: { maxDelegationDepth: 2, maxParallelAgents: 3 }, agents: [
  { id: 'parent', name: 'Parent', kind: 'primary', toolPolicy: { default: 'deny', allow: ['agent.delegate'], approvalRequired: [] } },
  { id: 'specialist', name: 'Specialist', kind: 'specialist', toolPolicy: { default: 'deny', allow: ['repo.read'], approvalRequired: [] } }
] };
let sequence = 0;
const ledgerEntries = [];
const runLedger = {
  snapshot() { return { entries: ledgerEntries.slice() }; },
  recordDelegationStart(agentId, { parentTaskId }) { const taskId = `delegation-${++sequence}`; ledgerEntries.push({ action: 'agent.delegate', taskId, agentId, parentTaskId }); return { taskId }; },
  recordDelegationFinish(taskId, result) { ledgerEntries.push({ action: 'agent.delegate.finish', taskId, ...result }); }
};
const lifecycle = createAgentLifecycle({ maxConcurrent: 2 });
const parentAbort = new AbortController();
let release; let capturedSignal;
const delegator = createAgentDelegator({
  registry, traceId: 'trace-1', parentAgent: registry.agents[0], parentTaskId: 'root-1', runLedger, lifecycle, parentSignal: parentAbort.signal,
  async executeAgent({ signal }) { capturedSignal = signal; await new Promise((resolve) => { release = resolve; }); return { ok: true, content: 'late-success' }; }
});
const pending = delegator.delegate({ agentId: 'specialist', task: 'incele' });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(lifecycle.liveCount(), 1); assert.equal(capturedSignal?.aborted, false);
parentAbort.abort(); await new Promise((resolve) => setTimeout(resolve, 0)); assert.equal(capturedSignal.aborted, true);
release(); const cancelled = await pending;
assert.deepEqual(cancelled, { ok: false, error: 'DELEGATION_CANCELLED' });
assert.equal(lifecycle.get('delegation-1').state, 'cancelled'); assert.equal(ledgerEntries.at(-1).ok, false); assert.equal(ledgerEntries.at(-1).error, 'DELEGATION_CANCELLED');
const successLifecycle = createAgentLifecycle({ maxConcurrent: 2 });
const successDelegator = createAgentDelegator({ registry, traceId: 'trace-2', parentAgent: registry.agents[0], parentTaskId: 'root-2', runLedger, lifecycle: successLifecycle, async executeAgent() { return { ok: true, content: 'verified' }; } });
const succeeded = await successDelegator.delegate({ agentId: 'specialist', task: 'test sonucu üret', successCriteria: ['test çalışsın'], constraints: ['kapsam dışına çıkma'], evidenceRequired: ['exit 0'] });
assert.equal(succeeded.ok, true); assert.equal(succeeded.value.content, 'verified'); assert.equal(successLifecycle.get('delegation-2').state, 'completed');
assert.equal(await successDelegator.delegate({ agentId: 'specialist', task: 'x' }).then((result) => result.ok), true);
assert.throws(() => successLifecycle.start({ runId: 'delegation-2', execute: async () => null }), /AGENT_RUN_ALREADY_EXISTS/);
const limited = createAgentLifecycle({ maxConcurrent: 1 });
let hold;
// Fan-out bütçesi ledger'daki tüm agent.delegate kayıtlarından hesaplanır
// (docs/NESTED_DELEGATION.md), bu yüzden lifecycle eşzamanlılık sınırını
// ölçmek için taze bir ledger kullanılır.
const limitedLedgerEntries = [];
const limitedLedger = {
  snapshot() { return { entries: limitedLedgerEntries.slice() }; },
  recordDelegationStart(agentId, { parentTaskId }) { const taskId = `limited-${++sequence}`; limitedLedgerEntries.push({ action: 'agent.delegate', taskId, agentId, parentTaskId }); return { taskId }; },
  recordDelegationFinish(taskId, result) { limitedLedgerEntries.push({ action: 'agent.delegate.finish', taskId, ...result }); }
};
const limitedDelegator = createAgentDelegator({ registry, traceId: 'trace-3', parentAgent: registry.agents[0], parentTaskId: 'root-3', runLedger: limitedLedger, lifecycle: limited, async executeAgent() { await new Promise((resolve) => { hold = resolve; }); return { ok: true, content: 'held' }; } });
const firstRun = limitedDelegator.delegate({ agentId: 'specialist', task: 'hold' });
await new Promise((resolve) => setTimeout(resolve, 0));
const rejected = await limitedDelegator.delegate({ agentId: 'specialist', task: 'reject' });
assert.deepEqual(rejected, { ok: false, error: 'DELEGATION_CONCURRENCY_EXCEEDED' });
hold(); await firstRun;
console.log('delegation lifecycle tests passed');
