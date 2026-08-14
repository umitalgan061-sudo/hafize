import assert from 'node:assert/strict';
import { createAgentDelegator } from '../lib/agent-delegation.mjs';
import { createAgentRunLedger } from '../lib/agent-run-ledger.mjs';

const primary = {
  id: 'hafize-general',
  name: 'Hafize',
  kind: 'primary',
  toolPolicy: { default: 'deny', allow: ['agent.delegate'] }
};
const reviewer = {
  id: 'agency-code-reviewer',
  name: 'Code Reviewer',
  kind: 'specialist',
  toolPolicy: { default: 'deny', allow: ['repo.read'] }
};
const registry = {
  policy: { maxDelegationDepth: 2, maxParallelAgents: 2 },
  agents: [primary, reviewer]
};

function createDeferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

const controller = new AbortController();
const ledger = createAgentRunLedger({ traceId: 'trace-abort', agentId: primary.id });
const gate = createDeferred();
let receivedSignal = null;
const delegator = createAgentDelegator({
  registry,
  traceId: 'trace-abort',
  parentAgent: primary,
  parentTaskId: ledger.rootTaskId,
  runLedger: ledger,
  signal: controller.signal,
  async executeAgent(input) {
    receivedSignal = input.signal;
    await gate.promise;
    return { ok: true, content: 'late result' };
  }
});

const running = delegator.delegate({ agentId: reviewer.id, task: 'Uzun görev.' });
await Promise.resolve();
assert.equal(delegator.status().activeDelegations, 1);
controller.abort();
gate.resolve();
assert.equal(receivedSignal, controller.signal);
assert.deepEqual(await running, { ok: false, error: 'DELEGATION_CANCELLED' });
assert.deepEqual(delegator.status(), { cancelled: true, activeDelegations: 0, maxParallel: 2 });
assert.deepEqual(
  await delegator.delegate({ agentId: reviewer.id, task: 'Abort sonrası görev.' }),
  { ok: false, error: 'DELEGATION_CANCELLED' }
);
const entry = ledger.snapshot().entries.find((item) => item.action === 'agent.delegate');
assert.equal(entry.status, 'failed');
assert.equal(entry.detail, 'DELEGATION_CANCELLED');

const manualLedger = createAgentRunLedger({ traceId: 'trace-manual-cancel', agentId: primary.id });
let executeCalls = 0;
const manual = createAgentDelegator({
  registry,
  traceId: 'trace-manual-cancel',
  parentAgent: primary,
  parentTaskId: manualLedger.rootTaskId,
  runLedger: manualLedger,
  async executeAgent() {
    executeCalls += 1;
    return { ok: true, content: 'unexpected' };
  }
});
manual.cancel();
assert.deepEqual(
  await manual.delegate({ agentId: reviewer.id, task: 'Çalışmamalı.' }),
  { ok: false, error: 'DELEGATION_CANCELLED' }
);
assert.equal(executeCalls, 0);
assert.throws(() => createAgentDelegator({
  registry,
  traceId: 'trace-invalid-signal',
  parentAgent: primary,
  parentTaskId: manualLedger.rootTaskId,
  runLedger: manualLedger,
  executeAgent: async () => ({ ok: true }),
  signal: { aborted: false }
}), /INVALID_DELEGATION_RUNTIME:signal/);

console.log('agent delegation cancellation tests passed');