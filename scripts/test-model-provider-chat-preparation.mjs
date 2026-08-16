import assert from 'node:assert/strict';
import { createModelProviderChatPreparer } from '../lib/model-provider-chat-preparation.mjs';

const registry = {
  defaultAgent: 'minimal-engineer',
  agents: [
    {
      id: 'minimal-engineer',
      name: 'Minimal Engineer',
      kind: 'selector',
      description: 'Test selector',
      mission: ['Solve safely'],
      guardrails: ['No secret'],
      outputContract: ['answer'],
      toolPolicy: { default: 'deny', allow: [], deny: [] }
    }
  ]
};
const calls = [];
const contextCompactor = {
  thresholdTokens: 10_000,
  async prepare(messages, options) {
    calls.push({ messages, options });
    return {
      messages,
      meta: { compacted: false, beforeTokens: 42, afterTokens: 42 }
    };
  }
};
const preparer = createModelProviderChatPreparer({ registry, contextCompactor });
const controller = new AbortController();
const result = await preparer.prepare({
  model: 'local:qwen3',
  agentId: 'minimal-engineer',
  messages: [{ role: 'user', content: 'Merhaba' }],
  max_tokens: 512,
  temperature: 0.4,
  top_p: 0.9
}, { signal: controller.signal });

assert.equal(result.payload.model, 'local:qwen3');
assert.equal(result.payload.stream, true);
assert.equal(result.payload.max_tokens, 512);
assert.equal(result.payload.temperature, 0.4);
assert.equal(result.payload.top_p, 0.9);
assert.equal(result.payload.messages[0].role, 'system');
assert.match(result.payload.messages[0].content, /Minimal Engineer/);
assert.equal(result.payload.messages.at(-1).content, 'Merhaba');
assert.match(result.headers['X-Hafize-Trace-Id'], /^[0-9a-f-]{36}$/i);
assert.equal(result.headers['X-Hafize-Context-Compacted'], '0');
assert.equal(result.headers['X-Hafize-Context-Tokens-Before'], '42');
assert.equal(result.headers['X-Hafize-Context-Tokens-After'], '42');
assert.equal(calls[0].options.model, 'local:qwen3');
assert.equal(calls[0].options.signal, controller.signal);
assert.equal(JSON.stringify(result).includes('toolPolicy'), false);

const defaulted = await preparer.prepare({
  model: 'meta/llama',
  messages: [{ role: 'user', content: 'Selam' }]
});
assert.equal(defaulted.payload.max_tokens, 2048);
assert.equal(defaulted.payload.temperature, undefined);
assert.equal(defaulted.payload.top_p, undefined);

console.log('model provider chat preparation tests passed');
