import assert from 'node:assert/strict';
import { createAgentDelegator } from '../lib/agent-delegation.mjs';
import { createAgentRunLedger } from '../lib/agent-run-ledger.mjs';

const selector = {
  id: 'minimal-engineer',
  name: 'Minimal Engineer',
  kind: 'selector',
  toolPolicy: { default: 'deny', allow: ['agent.delegate'] }
};
const specialist = {
  id: 'agency-code-reviewer',
  name: 'Code Reviewer',
  kind: 'specialist',
  toolPolicy: { default: 'deny', allow: [] }
};
const registry = {
  policy: { maxDelegationDepth: 3, maxParallelAgents: 2 },
  agents: [selector, specialist]
};
const request = { agentId: specialist.id, task: 'Review ledger integrity.' };

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

function build(executeAgent, { parentSignal = null } = {}) {
  const runLedger = createAgentRunLedger({
    traceId: 'trace-ledger-result',
    agentId: selector.id,
    now: (() => {
      let tick = 1_900_000_000_000;
      return () => new Date(++tick);
    })()
  });
  const delegator = createAgentDelegator({
    registry,
    traceId: 'trace-ledger-result',
    parentAgent: selector,
    parentTaskId: runLedger.rootTaskId,
    parentSignal,
    runLedger,
    executeAgent
  });
  return { runLedger, delegator };
}

function childEntries(runLedger) {
  return runLedger.snapshot().entries.filter((entry) => entry.taskId !== runLedger.rootTaskId);
}

{
  const { runLedger, delegator } = build(async () => ({ ok: true, content: 'valid' }));
  const result = await delegator.delegate(request);
  assert.equal(result.ok, true);
  const [child] = childEntries(runLedger);
  assert.equal(child.action, 'agent.delegate');
  assert.equal(child.agentId, specialist.id);
  assert.equal(child.status, 'completed');
  assert.equal(child.detail, 'ok');

  const root = runLedger.finish({ ok: true, detail: 'done' });
  assert.equal(root.status, 'completed');
  assert.equal(runLedger.snapshot().entries.length, 2);
}

{
  const hostile = { ok: true };
  Object.defineProperty(hostile, 'content', {
    enumerable: true,
    get() { throw new Error('must not escape into ledger control flow'); }
  });
  const { runLedger, delegator } = build(async () => hostile);
  const result = await delegator.delegate(request);
  assert.deepEqual(result, { ok: false, error: 'DELEGATED_RESULT_INVALID' });
  const [child] = childEntries(runLedger);
  assert.equal(child.status, 'failed');
  assert.equal(child.detail, 'DELEGATED_RESULT_INVALID');

  const root = runLedger.finish({ ok: false, detail: 'child invalid' });
  assert.equal(root.status, 'failed');
  assert.equal(root.detail, 'child invalid');
}

{
  const gate = deferred();
  const { runLedger, delegator } = build(async () => gate.promise);
  const pending = delegator.delegate(request);
  await Promise.resolve();
  assert.throws(
    () => runLedger.finish({ ok: true }),
    /AGENT_RUN_HAS_OPEN_TASKS/,
    'root cannot seal while delegated child is still running'
  );
  const [runningChild] = childEntries(runLedger);
  assert.equal(runningChild.status, 'running');

  gate.resolve({ ok: true, content: 'now terminal' });
  assert.equal((await pending).ok, true);
  assert.equal(childEntries(runLedger)[0].status, 'completed');
  assert.equal(runLedger.finish({ ok: true }).status, 'completed');
}

{
  const gate = deferred();
  const parent = new AbortController();
  const { runLedger, delegator } = build(async () => gate.promise, { parentSignal: parent.signal });
  const pending = delegator.delegate(request);
  await Promise.resolve();
  parent.abort('client-left');
  gate.resolve({ ok: true, content: 'late success' });
  assert.deepEqual(await pending, { ok: false, error: 'DELEGATION_CANCELLED' });

  const [child] = childEntries(runLedger);
  assert.equal(child.status, 'blocked');
  assert.equal(child.detail, 'DELEGATION_CANCELLED');
  assert.equal(runLedger.finish({ ok: false, detail: 'cancelled' }).status, 'failed');
}

{
  const { runLedger, delegator } = build(async () => ({
    ok: false,
    error: 'provider returned raw token abc123'
  }));
  assert.deepEqual(await delegator.delegate(request), {
    ok: false,
    error: 'DELEGATED_RESULT_INVALID'
  });
  const serialized = JSON.stringify(runLedger.snapshot());
  assert.equal(serialized.includes('abc123'), false, 'raw delegated failure detail never enters ledger');
  assert.equal(childEntries(runLedger)[0].detail, 'DELEGATED_RESULT_INVALID');
}

{
  const { runLedger, delegator } = build(async () => ({
    ok: true,
    content: 'x'.repeat(32_769)
  }));
  assert.deepEqual(await delegator.delegate(request), {
    ok: false,
    error: 'DELEGATED_RESULT_INVALID'
  });
  assert.equal(childEntries(runLedger)[0].status, 'failed');
  assert.equal(runLedger.finish({ ok: false }).status, 'failed');
}

{
  const { runLedger, delegator } = build(async () => {
    throw new Error('sensitive stack text');
  });
  assert.deepEqual(await delegator.delegate(request), {
    ok: false,
    error: 'DELEGATED_AGENT_FAILED'
  });
  const serialized = JSON.stringify(runLedger.snapshot());
  assert.equal(serialized.includes('sensitive stack text'), false);
  assert.equal(childEntries(runLedger)[0].detail, 'DELEGATED_AGENT_FAILED');
}

console.log('agent delegation result ledger integrity tests passed');
