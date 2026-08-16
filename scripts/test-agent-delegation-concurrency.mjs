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
  defaultAgent: primary.id,
  policy: { maxDelegationDepth: 2, maxParallelAgents: 1 },
  agents: [primary, reviewer]
};
const runLedger = createAgentRunLedger({ traceId: 'trace-concurrency', agentId: primary.id });
let mode = 'wait';
let observedSignal = null;
const delegator = createAgentDelegator({
  registry,
  traceId: 'trace-concurrency',
  parentAgent: primary,
  parentTaskId: runLedger.rootTaskId,
  runLedger,
  async executeAgent(input) {
    observedSignal = input.signal;
    if (mode === 'success') return { ok: true, content: 'after-release' };
    return new Promise((resolve) => {
      input.signal.addEventListener('abort', () => resolve({ ok: false, error: 'INTERNAL_ABORT' }), { once: true });
    });
  }
});

const firstPromise = delegator.delegate({ agentId: reviewer.id, task: 'Uzun inceleme.' });
await new Promise((resolve) => setImmediate(resolve));
assert.equal(delegator.lifecycleSnapshot().active, 1);
assert.equal(observedSignal?.aborted, false);

const parallel = await delegator.delegate({ agentId: reviewer.id, task: 'Aynı anda ikinci görev.' });
assert.deepEqual(parallel, { ok: false, error: 'DELEGATION_PARALLEL_LIMIT_EXCEEDED' });
const blocked = runLedger.snapshot().entries.filter((entry) => entry.action === 'agent.delegate')[1];
assert.equal(blocked.status, 'blocked');
assert.equal(blocked.detail, 'DELEGATION_PARALLEL_LIMIT_EXCEEDED');

const activeTaskId = delegator.lifecycleSnapshot().taskIds[0];
assert.equal(delegator.cancel(activeTaskId), true);
const cancelled = await firstPromise;
assert.deepEqual(cancelled, { ok: false, error: 'DELEGATION_CANCELLED' });
const firstEntry = runLedger.snapshot().entries.find((entry) => entry.taskId === activeTaskId);
assert.equal(firstEntry.status, 'blocked');
assert.equal(firstEntry.detail, 'DELEGATION_CANCELLED');
assert.equal(delegator.lifecycleSnapshot().active, 0);

mode = 'success';
const sequential = await delegator.delegate({ agentId: reviewer.id, task: 'Slot boşaldıktan sonra.' });
assert.equal(sequential.ok, true);
assert.equal(sequential.value.content, 'after-release');
assert.equal(delegator.lifecycleSnapshot().active, 0);

const parent = new AbortController();
const parentLedger = createAgentRunLedger({ traceId: 'trace-parent-abort', agentId: primary.id });
const parentDelegator = createAgentDelegator({
  registry,
  traceId: 'trace-parent-abort',
  parentAgent: primary,
  parentTaskId: parentLedger.rootTaskId,
  parentSignal: parent.signal,
  runLedger: parentLedger,
  async executeAgent(input) {
    return new Promise((resolve) => {
      input.signal.addEventListener('abort', () => resolve({ ok: false, error: 'UPSTREAM_ABORT' }), { once: true });
    });
  }
});
const parentRun = parentDelegator.delegate({ agentId: reviewer.id, task: 'İstek kapanınca kes.' });
await new Promise((resolve) => setImmediate(resolve));
parent.abort('request_closed');
assert.deepEqual(await parentRun, { ok: false, error: 'DELEGATION_CANCELLED' });
assert.equal(parentLedger.snapshot().entries.find((entry) => entry.action === 'agent.delegate').status, 'blocked');

console.log('agent delegation concurrency tests passed');
