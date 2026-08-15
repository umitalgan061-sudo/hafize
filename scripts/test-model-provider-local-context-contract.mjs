import assert from 'node:assert/strict';
import { createModelProviderChatPreparer } from '../lib/model-provider-chat-preparation.mjs';

const registry = {
  defaultAgent: 'minimal-engineer',
  agents: [{
    id: 'minimal-engineer', name: 'Minimal Engineer', kind: 'selector', description: 'Test',
    mission: [], guardrails: [], outputContract: [], toolPolicy: { default: 'deny', allow: [], deny: [] }
  }]
};

for (const contextCompactor of [
  null,
  {},
  { prepare() {} },
  { thresholdTokens: 0, prepare() {} },
  { thresholdTokens: 1.5, prepare() {} }
]) {
  assert.throws(
    () => createModelProviderChatPreparer({ registry, contextCompactor }),
    /INVALID_MODEL_PROVIDER_CHAT_PREPARER:contextCompactor/
  );
}

let calls = 0;
const contextCompactor = {
  thresholdTokens: 140,
  async prepare(messages) {
    calls += 1;
    return {
      messages,
      meta: { compacted: false, beforeTokens: 100, afterTokens: 100 }
    };
  }
};
const preparer = createModelProviderChatPreparer({ registry, contextCompactor });

const nearThreshold = [{ role: 'user', content: 'a'.repeat(120) }];
await preparer.prepare({ model: 'local:qwen3', messages: nearThreshold });
assert.equal(calls, 1);

const oversized = [{ role: 'user', content: 'a'.repeat(1000) }];
await assert.rejects(
  () => preparer.prepare({ model: 'local:qwen3', messages: oversized }),
  /LOCAL_CONTEXT_COMPACTION_UNAVAILABLE/
);
assert.equal(calls, 1, 'blocked local request must not enter compactor.prepare');

const exactPrefixCases = [
  ['local:qwen3', true],
  ['local:', true],
  ['localish:qwen3', false],
  ['LOCAL:qwen3', false],
  ['nvidia/local:qwen3', false]
];
for (const [model, blocked] of exactPrefixCases) {
  const before = calls;
  let error = null;
  try {
    await preparer.prepare({ model, messages: oversized });
  } catch (caught) {
    error = caught;
  }
  if (blocked) {
    assert.equal(error?.code, 'LOCAL_CONTEXT_COMPACTION_UNAVAILABLE');
    assert.equal(calls, before);
  } else {
    assert.equal(error, null);
    assert.equal(calls, before + 1);
  }
}

const controller = new AbortController();
controller.abort();
await assert.rejects(
  () => preparer.prepare({ model: 'local:qwen3', messages: oversized }, { signal: controller.signal }),
  /MODEL_PROVIDER_CANCELLED/
);

console.log('model provider local context contract tests passed');
