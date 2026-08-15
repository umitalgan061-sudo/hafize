import assert from 'node:assert/strict';
import { createContextCompactor } from '../lib/context-compaction.mjs';
import { createModelProviderContextCompactor } from '../lib/model-provider-context-compaction.mjs';

function largeMessages() {
  const messages = [{ role: 'system', content: 'system boundary' }];
  for (let index = 0; index < 10; index += 1) {
    messages.push({ role: index % 2 ? 'assistant' : 'user', content: 'z'.repeat(5000) });
  }
  return messages;
}

function baseCompactor() {
  return createContextCompactor({
    contextLimitTokens: 16_000,
    triggerRatio: 0.5,
    preserveRecentMessages: 4,
    async summarize() {
      throw new Error('DEFAULT_SUMMARIZER_MUST_NOT_RUN_FOR_LOCAL');
    }
  });
}

for (const [label, response] of [
  ['provider failure', { ok: false, status: 502, error: 'LOCAL_PROVIDER_FAILED' }],
  ['provider mismatch', {
    ok: true,
    status: 200,
    value: {
      provider: 'nvidia',
      result: { choices: [{ message: { role: 'assistant', content: 'wrong provider' } }] }
    }
  }],
  ['empty summary', {
    ok: true,
    status: 200,
    value: {
      provider: 'local',
      result: { choices: [{ message: { role: 'assistant', content: '   ' } }] }
    }
  }]
]) {
  let calls = 0;
  const compactor = createModelProviderContextCompactor({
    baseCompactor: baseCompactor(),
    async complete() {
      calls += 1;
      return response;
    }
  });
  await assert.rejects(
    () => compactor.prepare(largeMessages(), { model: 'local:qwen3' }),
    (error) => {
      assert.equal(error.code, 'LOCAL_CONTEXT_COMPACTION_FAILED', label);
      assert.equal(error.status, 413);
      return true;
    }
  );
  assert.equal(calls, 1, label);
}

let providerCalls = 0;
const cancelledCompactor = createModelProviderContextCompactor({
  baseCompactor: baseCompactor(),
  async complete() {
    providerCalls += 1;
    throw new Error('must not run');
  }
});
const controller = new AbortController();
controller.abort();
await assert.rejects(
  () => cancelledCompactor.prepare(largeMessages(), { model: 'local:qwen3', signal: controller.signal }),
  (error) => {
    assert.equal(error.code, 'MODEL_PROVIDER_CANCELLED');
    assert.equal(error.status, 499);
    return true;
  }
);
assert.equal(providerCalls, 0);

assert.throws(
  () => createModelProviderContextCompactor({ baseCompactor: null, complete: async () => ({}) }),
  /INVALID_PROVIDER_CONTEXT_COMPACTOR:baseCompactor/
);
assert.throws(
  () => createModelProviderContextCompactor({ baseCompactor: baseCompactor(), complete: null }),
  /INVALID_PROVIDER_CONTEXT_COMPACTOR:complete/
);
assert.throws(
  () => createModelProviderContextCompactor({ baseCompactor: baseCompactor(), complete: async () => ({}), summaryMaxTokens: 5000 }),
  /INVALID_PROVIDER_CONTEXT_COMPACTOR:summaryMaxTokens/
);

console.log('model provider context compaction security tests passed');
