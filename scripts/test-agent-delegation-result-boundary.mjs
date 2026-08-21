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
const registry = {
  policy: { maxDelegationDepth: 3, maxParallelAgents: 2 },
  agents: [parentAgent, specialist]
};
const handoff = { agentId: 'reviewer', task: 'Inspect this result boundary.' };

function ledgerFixture() {
  let nextId = 0;
  const starts = [];
  const finishes = [];
  return {
    starts,
    finishes,
    recordDelegationStart(agentId, options) {
      const entry = { taskId: `delegation-${++nextId}`, agentId, parentTaskId: options.parentTaskId };
      starts.push(entry);
      return entry;
    },
    recordDelegationFinish(taskId, result) {
      const entry = { taskId, ...result };
      finishes.push(entry);
      return entry;
    },
    snapshot() {
      return { starts: [...starts], finishes: [...finishes] };
    }
  };
}

function createHarness(executeAgent, { parentSignal = null } = {}) {
  const runLedger = ledgerFixture();
  const delegator = createAgentDelegator({
    registry,
    traceId: 'trace-result-boundary',
    parentAgent,
    parentTaskId: 'root-task',
    parentSignal,
    runLedger,
    executeAgent
  });
  return { runLedger, delegator };
}

{
  const { runLedger, delegator } = createHarness(async () => ({ ok: true, content: 'bounded answer' }));
  const result = await delegator.delegate(handoff);
  assert.deepEqual(result, {
    ok: true,
    value: { agentId: 'reviewer', agentName: 'Reviewer', content: 'bounded answer' }
  });
  assert.equal(runLedger.starts.length, 1);
  assert.deepEqual(runLedger.finishes, [{ taskId: 'delegation-1', ok: true }]);
  assert.equal(delegator.lifecycleSnapshot().active, 0);
}

{
  const nullProto = Object.create(null);
  nullProto.ok = true;
  nullProto.content = 'null prototype is data-only';
  const { runLedger, delegator } = createHarness(async () => nullProto);
  const result = await delegator.delegate(handoff);
  assert.equal(result.ok, true);
  assert.equal(result.value.content, 'null prototype is data-only');
  assert.deepEqual(runLedger.finishes, [{ taskId: 'delegation-1', ok: true }]);
}

{
  const { runLedger, delegator } = createHarness(async () => ({ ok: false, error: 'CHILD_POLICY_FAILED' }));
  const result = await delegator.delegate(handoff);
  assert.deepEqual(result, { ok: false, error: 'CHILD_POLICY_FAILED' });
  assert.deepEqual(runLedger.finishes, [{
    taskId: 'delegation-1', ok: false, blocked: false, error: 'CHILD_POLICY_FAILED'
  }]);
}

for (const invalidResult of [
  { ok: true, content: 'x', secret: 'must not pass through' },
  { ok: false, error: 'raw provider exception includes details' },
  { ok: false, error: 'FAILED', detail: 'connector payload' },
  { ok: true, content: 123 },
  ['not', 'a', 'result'],
  null
]) {
  const { runLedger, delegator } = createHarness(async () => invalidResult);
  const result = await delegator.delegate(handoff);
  assert.deepEqual(result, { ok: false, error: 'DELEGATED_RESULT_INVALID' });
  assert.deepEqual(runLedger.finishes, [{
    taskId: 'delegation-1', ok: false, blocked: false, error: 'DELEGATED_RESULT_INVALID'
  }]);
  assert.equal(delegator.lifecycleSnapshot().active, 0);
}

{
  let getterReads = 0;
  const hostile = { ok: true };
  Object.defineProperty(hostile, 'content', {
    enumerable: true,
    get() {
      getterReads += 1;
      throw new Error('secret-bearing getter must not execute');
    }
  });
  const { runLedger, delegator } = createHarness(async () => hostile);
  const result = await delegator.delegate(handoff);
  assert.deepEqual(result, { ok: false, error: 'DELEGATED_RESULT_INVALID' });
  assert.equal(getterReads, 0);
  assert.equal(runLedger.finishes.length, 1);
  assert.equal(runLedger.finishes[0].error, 'DELEGATED_RESULT_INVALID');
}

{
  const hostile = new Proxy({ ok: true, content: 'x' }, {
    getOwnPropertyDescriptor() {
      throw new Error('descriptor trap');
    }
  });
  const { runLedger, delegator } = createHarness(async () => hostile);
  const result = await delegator.delegate(handoff);
  assert.deepEqual(result, { ok: false, error: 'DELEGATED_RESULT_INVALID' });
  assert.equal(runLedger.finishes.length, 1, 'hostile object still reaches one terminal ledger finish');
}

{
  const { runLedger, delegator } = createHarness(async () => {
    throw new Error('raw child exception with sensitive context');
  });
  const result = await delegator.delegate(handoff);
  assert.deepEqual(result, { ok: false, error: 'DELEGATED_AGENT_FAILED' });
  assert.equal(runLedger.finishes[0].error, 'DELEGATED_AGENT_FAILED');
  assert.equal(JSON.stringify(runLedger.finishes).includes('sensitive context'), false);
}

{
  const mutated = { ok: true, content: 'first value' };
  const { runLedger, delegator } = createHarness(async () => mutated);
  const pending = delegator.delegate(handoff);
  const result = await pending;
  mutated.content = 'changed after return';
  assert.equal(result.value.content, 'first value');
  assert.deepEqual(runLedger.finishes, [{ taskId: 'delegation-1', ok: true }]);
}

console.log('agent delegation result boundary tests passed');
