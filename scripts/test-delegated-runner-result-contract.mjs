import assert from 'node:assert/strict';
import { runDelegatedAgent } from '../lib/delegated-agent-runner.mjs';
import { normalizeDelegatedAgentResult } from '../lib/delegated-agent-result-policy.mjs';

const agent = {
  id: 'agency-code-reviewer',
  name: 'Code Reviewer',
  kind: 'specialist',
  description: 'Read-only reviewer.',
  mission: ['Review safely.'],
  guardrails: [],
  outputContract: ['summary'],
  toolPolicy: { default: 'deny', allow: [], deny: [], approvalRequired: [] }
};
const registry = {
  policy: { maxDelegationDepth: 3, maxParallelAgents: 2 },
  agents: [agent]
};
const runLedger = {
  recordToolStart() { throw new Error('no tool should be started'); },
  recordToolFinish() { throw new Error('no tool should be finished'); },
  recordDelegationStart() { throw new Error('no nested delegation should be started'); },
  recordDelegationFinish() { throw new Error('no nested delegation should be finished'); },
  snapshot() { return { entries: [] }; }
};

function baseArgs(complete, overrides = {}) {
  return {
    agent,
    task: 'Return a concise review.',
    traceId: 'trace-runner-contract',
    parentTaskId: 'delegation-task',
    depth: 1,
    registry,
    runLedger,
    model: 'nvidia/test-model',
    complete,
    ...overrides
  };
}

{
  let calls = 0;
  const result = await runDelegatedAgent(baseArgs(async (payload) => {
    calls += 1;
    assert.equal(payload.stream, false);
    assert.equal(payload.messages.at(-1).role, 'user');
    return { choices: [{ message: { role: 'assistant', content: 'safe review' } }] };
  }));
  assert.deepEqual(result, { ok: true, content: 'safe review' });
  assert.equal(calls, 1);
  const normalized = normalizeDelegatedAgentResult(result);
  assert.equal(normalized.ok, true);
  assert.deepEqual(normalized.result, result);
}

{
  const result = await runDelegatedAgent(baseArgs(async () => ({ choices: [] })));
  assert.deepEqual(result, { ok: false, error: 'INVALID_NVIDIA_RESPONSE' });
  const normalized = normalizeDelegatedAgentResult(result);
  assert.equal(normalized.ok, true);
  assert.deepEqual(normalized.result, result);
}

{
  const result = await runDelegatedAgent(baseArgs(async () => ({
    choices: [{ message: { role: 'assistant', content: 'never used' } }]
  }), { model: 'local:qwen' }));
  assert.deepEqual(result, { ok: false, error: 'LOCAL_PROVIDER_TOOLS_UNSUPPORTED' });
  assert.equal(normalizeDelegatedAgentResult(result).ok, true);
}

{
  const controller = new AbortController();
  controller.abort('parent-left');
  let called = false;
  const result = await runDelegatedAgent(baseArgs(async () => {
    called = true;
    return { choices: [{ message: { role: 'assistant', content: 'late' } }] };
  }, { signal: controller.signal }));
  assert.deepEqual(result, { ok: false, error: 'DELEGATION_CANCELLED' });
  assert.equal(called, false);
  assert.equal(normalizeDelegatedAgentResult(result).ok, true);
}

{
  const result = await runDelegatedAgent(baseArgs(async () => ({
    choices: [{ message: { role: 'assistant', content: '' } }]
  })));
  assert.deepEqual(result, { ok: true, content: '' });
  assert.equal(normalizeDelegatedAgentResult(result).ok, true);
}

console.log('delegated runner result contract tests passed');
