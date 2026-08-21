import assert from 'node:assert/strict';
import { createAgentDelegator } from '../lib/agent-delegation.mjs';

const parentAgent = {
  id: 'selector',
  name: 'Selector',
  kind: 'selector',
  toolPolicy: { default: 'deny', allow: ['agent.delegate'] }
};
const specialist = {
  id: 'reviewer',
  name: 'Reviewer',
  kind: 'specialist',
  toolPolicy: { default: 'deny', allow: [] }
};
const baseRegistry = {
  policy: { maxDelegationDepth: 3, maxParallelAgents: 1 },
  agents: [parentAgent, specialist]
};
const handoff = { agentId: 'reviewer', task: 'Exercise cancellation precedence.' };

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function fakeLedger() {
  let next = 0;
  const starts = [];
  const finishes = [];
  return {
    starts,
    finishes,
    recordDelegationStart(agentId, { parentTaskId }) {
      const entry = { taskId: `task-${++next}`, agentId, parentTaskId };
      starts.push(entry);
      return entry;
    },
    recordDelegationFinish(taskId, result) {
      const entry = { taskId, ...result };
      finishes.push(entry);
      return entry;
    },
    snapshot: () => ({ starts: [...starts], finishes: [...finishes] })
  };
}

function harness(executeAgent, { parentSignal = null, registry = baseRegistry } = {}) {
  const runLedger = fakeLedger();
  const delegator = createAgentDelegator({
    registry,
    traceId: 'trace-races',
    parentAgent,
    parentTaskId: 'root',
    parentSignal,
    runLedger,
    executeAgent
  });
  return { runLedger, delegator };
}

{
  const gate = deferred();
  let childSignal;
  const { runLedger, delegator } = harness(async ({ signal }) => {
    childSignal = signal;
    return gate.promise;
  });
  const pending = delegator.delegate(handoff);
  await Promise.resolve();
  assert.equal(runLedger.starts[0].taskId, 'task-1');
  assert.equal(delegator.lifecycleSnapshot().active, 1);
  assert.equal(delegator.cancel('task-1', 'user-stop'), true);
  assert.equal(childSignal.aborted, true);

  gate.resolve({ ok: true, content: 'late success must lose' });
  const result = await pending;
  assert.deepEqual(result, { ok: false, error: 'DELEGATION_CANCELLED' });
  assert.deepEqual(runLedger.finishes, [{
    taskId: 'task-1', ok: false, blocked: true, error: 'DELEGATION_CANCELLED'
  }]);
  assert.equal(delegator.lifecycleSnapshot().active, 0);
}

{
  const parent = new AbortController();
  const gate = deferred();
  let childSignal;
  const { runLedger, delegator } = harness(async ({ signal }) => {
    childSignal = signal;
    return gate.promise;
  }, { parentSignal: parent.signal });
  const pending = delegator.delegate(handoff);
  await Promise.resolve();
  parent.abort('request-disconnected');
  assert.equal(childSignal.aborted, true);
  gate.resolve({ ok: false, error: 'CHILD_FAILED' });

  const result = await pending;
  assert.deepEqual(result, { ok: false, error: 'DELEGATION_CANCELLED' });
  assert.equal(runLedger.finishes[0].blocked, true);
  assert.equal(runLedger.finishes[0].error, 'DELEGATION_CANCELLED');
}

{
  const gate = deferred();
  const { runLedger, delegator } = harness(async () => gate.promise);
  const first = delegator.delegate(handoff);
  await Promise.resolve();
  const second = await delegator.delegate(handoff);
  assert.deepEqual(second, { ok: false, error: 'DELEGATION_PARALLEL_LIMIT_EXCEEDED' });
  assert.deepEqual(runLedger.finishes[0], {
    taskId: 'task-2',
    ok: false,
    blocked: true,
    error: 'DELEGATION_PARALLEL_LIMIT_EXCEEDED'
  });
  assert.equal(delegator.lifecycleSnapshot().active, 1);

  gate.resolve({ ok: true, content: 'first completes' });
  assert.equal((await first).ok, true);
  assert.equal(delegator.lifecycleSnapshot().active, 0);
  assert.deepEqual(runLedger.finishes[1], { taskId: 'task-1', ok: true });
}

{
  const gate = deferred();
  const { runLedger, delegator } = harness(async () => gate.promise);
  const pending = delegator.delegate(handoff);
  await Promise.resolve();
  assert.equal(delegator.cancelAll('parent-shutdown'), 1);
  assert.equal(delegator.lifecycleSnapshot().closed, true);
  gate.resolve({ ok: true, content: 'late after cancelAll' });
  assert.deepEqual(await pending, { ok: false, error: 'DELEGATION_CANCELLED' });

  const afterClose = await delegator.delegate(handoff);
  assert.deepEqual(afterClose, { ok: false, error: 'DELEGATION_LIFECYCLE_CLOSED' });
  assert.equal(runLedger.finishes.at(-1).error, 'DELEGATION_LIFECYCLE_CLOSED');
}

{
  const gate = deferred();
  const { runLedger, delegator } = harness(async () => gate.promise);
  const pending = delegator.delegate(handoff);
  await Promise.resolve();
  delegator.cancel('task-1');
  gate.reject(new Error('late provider exception including private detail'));
  const result = await pending;
  assert.deepEqual(result, { ok: false, error: 'DELEGATION_CANCELLED' });
  assert.equal(JSON.stringify(runLedger.finishes).includes('private detail'), false);
}

{
  const gate = deferred();
  const { runLedger, delegator } = harness(async () => gate.promise);
  const pending = delegator.delegate(handoff);
  await Promise.resolve();
  gate.resolve(new Proxy({ ok: true, content: 'hostile' }, {
    getOwnPropertyDescriptor() { throw new Error('late proxy trap'); }
  }));
  const result = await pending;
  assert.deepEqual(result, { ok: false, error: 'DELEGATED_RESULT_INVALID' });
  assert.deepEqual(runLedger.finishes, [{
    taskId: 'task-1', ok: false, blocked: false, error: 'DELEGATED_RESULT_INVALID'
  }]);
  assert.equal(delegator.lifecycleSnapshot().active, 0, 'invalid result always releases its lease');
}

console.log('agent delegation result race tests passed');
