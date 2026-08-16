import assert from 'node:assert/strict';
import { createModelProviderNodeServerRuntime } from '../lib/model-provider-node-server-runtime.mjs';

const providerCalls = [];
const provider = {
  nvidiaConfigured: true,
  localConfigured: true,
  defaultProvider: 'nvidia',
  async complete(payload, options) {
    providerCalls.push({ payload, options });
    return {
      ok: true,
      status: 200,
      value: {
        provider: 'local',
        result: { choices: [{ message: { content: 'yerel özet' } }] }
      }
    };
  },
  async stream() { throw new Error('stream not expected'); },
  async listModels() { return { ok: true, value: [] }; }
};

let composedCompactor = null;
const baseCompactor = {
  thresholdTokens: 10,
  contextLimitTokens: 100,
  async prepare(messages, { model, signal, summarize } = {}) {
    assert.equal(model, 'local:qwen');
    assert.equal(typeof summarize, 'function');
    const summary = await summarize({
      model,
      source: 'eski konuşma',
      messageCount: 4,
      signal
    });
    assert.equal(summary, 'yerel özet');
    return {
      messages: [{ role: 'system', content: summary }, ...messages.slice(-1)],
      meta: { compacted: true, beforeTokens: 30, afterTokens: 8 }
    };
  }
};

createModelProviderNodeServerRuntime({
  registry: { defaultAgent: 'minimal-engineer', agents: [] },
  baseCompactor,
  readJson() {},
  sendJson() {},
  setSecurityHeaders() {},
  createProvider: () => provider,
  createChatPreparer({ contextCompactor }) {
    composedCompactor = contextCompactor;
    return { prepare() {} };
  },
  createHttpApi: () => ({ handle() {} }),
  createNodeRoute: () => ({ handle() {} })
});

assert.equal(composedCompactor.supportsLocalModels, true);
const controller = new AbortController();
const prepared = await composedCompactor.prepare(
  [{ role: 'user', content: 'yeni mesaj' }],
  { model: 'local:qwen', signal: controller.signal }
);
assert.equal(prepared.meta.compacted, true);
assert.equal(providerCalls.length, 1);
assert.equal(providerCalls[0].payload.model, 'local:qwen');
assert.equal(providerCalls[0].payload.stream, false);
assert.equal(providerCalls[0].options.signal, controller.signal);
assert.equal(providerCalls[0].options.toolsRequired, false);
assert.equal(JSON.stringify(providerCalls[0].payload).includes('NVIDIA'), false);

console.log('model provider node server local compaction binding tests passed');
