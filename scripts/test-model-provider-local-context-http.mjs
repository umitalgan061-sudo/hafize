import assert from 'node:assert/strict';
import { createContextCompactor } from '../lib/context-compaction.mjs';
import { createModelProviderChatPreparer } from '../lib/model-provider-chat-preparation.mjs';
import { createModelProviderHttpApi } from '../lib/model-provider-http-api.mjs';

const registry = {
  defaultAgent: 'minimal-engineer',
  agents: [{
    id: 'minimal-engineer', name: 'Minimal Engineer', kind: 'selector', description: 'Safe selector',
    mission: [], guardrails: [], outputContract: ['answer'],
    toolPolicy: { default: 'deny', allow: [], deny: [] }
  }]
};

let summaries = 0;
const compactor = createContextCompactor({
  contextLimitTokens: 16_000,
  triggerRatio: 0.5,
  preserveRecentMessages: 4,
  async summarize() {
    summaries += 1;
    return 'safe summary';
  }
});
const preparer = createModelProviderChatPreparer({ registry, contextCompactor: compactor });
let streamCalls = 0;
let lastPayload = null;
const provider = {
  async listModels() { return { ok: true, value: { models: ['nvidia/model', 'local:qwen3'] } }; },
  async stream(payload) {
    streamCalls += 1;
    lastPayload = payload;
    return {
      ok: true,
      value: {
        provider: payload.model.startsWith('local:') ? 'local' : 'nvidia',
        body: (async function* () { yield Buffer.from('data: ok\n\n'); })()
      }
    };
  }
};
const api = createModelProviderHttpApi({
  provider,
  async readJson(request) { return request.body; },
  prepareChat: preparer.prepare
});

const huge = Array.from({ length: 10 }, (_, index) => ({
  role: index % 2 === 0 ? 'user' : 'assistant',
  content: `${index}:${'x'.repeat(9000)}`
}));

const blocked = await api.handle({
  request: { body: { model: 'local:qwen3', messages: huge } },
  method: 'POST',
  pathname: '/api/chat'
});
assert.equal(blocked.matched, true);
assert.equal(blocked.kind, 'json');
assert.equal(blocked.status, 413);
assert.deepEqual(blocked.body, { error: 'LOCAL_CONTEXT_COMPACTION_UNAVAILABLE' });
assert.deepEqual(blocked.headers, { 'Cache-Control': 'no-store' });
assert.equal(streamCalls, 0, 'oversized local chat must stop before provider.stream');
assert.equal(summaries, 0, 'oversized local chat must stop before summary provider use');
assert.equal(JSON.stringify(blocked).includes('qwen3'), false);

const nvidia = await api.handle({
  request: { body: { model: 'nvidia/model', messages: huge } },
  method: 'POST',
  pathname: '/api/chat'
});
assert.equal(nvidia.kind, 'stream');
assert.equal(nvidia.status, 200);
assert.equal(nvidia.provider, 'nvidia');
assert.equal(streamCalls, 1);
assert.equal(summaries, 1);
assert.equal(lastPayload.model, 'nvidia/model');
assert.equal(lastPayload.stream, true);
assert.equal(lastPayload.messages.some((message) => String(message.content || '').includes('safe summary')), true);

const smallLocal = await api.handle({
  request: { body: { model: 'local:qwen3', messages: [{ role: 'user', content: 'Kısa' }] } },
  method: 'POST',
  pathname: '/api/chat'
});
assert.equal(smallLocal.kind, 'stream');
assert.equal(smallLocal.provider, 'local');
assert.equal(streamCalls, 2);
assert.equal(summaries, 1);

console.log('model provider local context HTTP tests passed');
