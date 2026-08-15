import assert from 'node:assert/strict';
import { createContextCompactor } from '../lib/context-compaction.mjs';
import { createModelProviderChatPreparer } from '../lib/model-provider-chat-preparation.mjs';

const registry = {
  defaultAgent: 'minimal-engineer',
  agents: [{
    id: 'minimal-engineer',
    name: 'Minimal Engineer',
    kind: 'selector',
    description: 'Safe selector',
    mission: ['Keep provider boundaries explicit'],
    guardrails: ['Never move credentials between providers'],
    outputContract: ['answer'],
    toolPolicy: { default: 'deny', allow: [], deny: [] }
  }]
};

const summarizeCalls = [];
const compactor = createContextCompactor({
  contextLimitTokens: 16_000,
  triggerRatio: 0.5,
  preserveRecentMessages: 4,
  async summarize(input) {
    summarizeCalls.push(input);
    return 'Older conversation summarized safely.';
  }
});
const preparer = createModelProviderChatPreparer({ registry, contextCompactor: compactor });

const smallLocal = await preparer.prepare({
  model: 'local:qwen3',
  messages: [{ role: 'user', content: 'Kısa yerel konuşma' }]
});
assert.equal(smallLocal.payload.model, 'local:qwen3');
assert.equal(smallLocal.headers['X-Hafize-Context-Compacted'], '0');
assert.equal(summarizeCalls.length, 0);

const longHistory = [];
for (let index = 0; index < 12; index += 1) {
  longHistory.push({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `${index}: ${'uzun-bağlam '.repeat(3200)}`
  });
}

await assert.rejects(
  () => preparer.prepare({ model: 'local:qwen3', messages: longHistory }),
  (error) => {
    assert.equal(error.code, 'LOCAL_CONTEXT_COMPACTION_UNAVAILABLE');
    assert.equal(error.status, 413);
    return true;
  }
);
assert.equal(summarizeCalls.length, 0, 'local model must never invoke the NVIDIA-backed compactor summary path');

const nvidiaResult = await preparer.prepare({
  model: 'meta/llama-3.1-70b-instruct',
  messages: longHistory
});
assert.equal(summarizeCalls.length, 1);
assert.equal(summarizeCalls[0].model, 'meta/llama-3.1-70b-instruct');
assert.equal(nvidiaResult.headers['X-Hafize-Context-Compacted'], '1');
assert.ok(Number(nvidiaResult.headers['X-Hafize-Context-Tokens-After']) < Number(nvidiaResult.headers['X-Hafize-Context-Tokens-Before']));
assert.equal(nvidiaResult.payload.messages[0].role, 'system');
assert.equal(nvidiaResult.payload.messages.some((message) => String(message.content || '').includes('Older conversation summarized safely.')), true);

const boundaryCases = [
  'LOCAL:qwen3',
  'localish:qwen3',
  'https://local:qwen3'
];
for (const model of boundaryCases) {
  summarizeCalls.length = 0;
  await preparer.prepare({ model, messages: longHistory });
  assert.equal(summarizeCalls.length, 1, `${model} must not be treated as the reserved local: provider prefix`);
}

console.log('model provider local context guard tests passed');
