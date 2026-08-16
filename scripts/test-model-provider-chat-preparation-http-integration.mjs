import assert from 'node:assert/strict';
import { createModelProviderChatPreparer } from '../lib/model-provider-chat-preparation.mjs';
import { createModelProviderHttpApi } from '../lib/model-provider-http-api.mjs';

const registry = {
  defaultAgent: 'minimal-engineer',
  agents: [{
    id: 'minimal-engineer', name: 'Minimal Engineer', kind: 'selector', description: 'Safe selector',
    mission: ['Do the smallest safe change'], guardrails: ['No secrets'], outputContract: ['answer'],
    toolPolicy: { default: 'deny', allow: ['repo.read'], approvalRequired: ['repo.write_branch'], deny: ['repo.merge'] }
  }]
};
const preparer = createModelProviderChatPreparer({
  registry,
  contextCompactor: {
    thresholdTokens: 10_000,
    async prepare(messages) {
      return { messages, meta: { compacted: false, beforeTokens: 22, afterTokens: 22 } };
    }
  }
});
let streamedPayload = null;
let streamedOptions = null;
const api = createModelProviderHttpApi({
  provider: {
    async listModels() { return { ok: true, value: { models: ['local:qwen3'] } }; },
    async stream(payload, options) {
      streamedPayload = payload;
      streamedOptions = options;
      return {
        ok: true,
        value: {
          provider: 'local',
          body: (async function* () { yield Buffer.from('data: ok\n\n'); })()
        }
      };
    }
  },
  async readJson(request) { return request.body; },
  prepareChat: preparer.prepare
});

const result = await api.handle({
  request: {
    body: {
      model: 'local:qwen3',
      messages: [{ role: 'user', content: 'Durumu özetle' }],
      max_tokens: 256
    }
  },
  method: 'POST',
  pathname: '/api/chat'
});

assert.equal(result.status, 200);
assert.equal(result.kind, 'stream');
assert.equal(result.provider, 'local');
assert.equal(streamedPayload.model, 'local:qwen3');
assert.equal(streamedPayload.stream, true);
assert.equal(streamedPayload.max_tokens, 256);
assert.equal(streamedPayload.messages[0].role, 'system');
assert.match(streamedPayload.messages[0].content, /Minimal Engineer/);
assert.equal('tools' in streamedPayload, false);
assert.equal('tool_choice' in streamedPayload, false);
assert.deepEqual(streamedOptions.toolsRequired, false);
assert.match(result.headers['X-Hafize-Trace-Id'], /^[0-9a-f-]{36}$/i);
assert.equal(result.headers['X-Hafize-Context-Compacted'], '0');
assert.equal(JSON.stringify(result.headers).includes('repo.write_branch'), false);

let body = '';
for await (const chunk of result.body) body += chunk.toString();
assert.equal(body, 'data: ok\n\n');

console.log('model provider chat preparation HTTP integration tests passed');
