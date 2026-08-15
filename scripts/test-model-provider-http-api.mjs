import assert from 'node:assert/strict';
import { createModelProviderHttpApi } from '../lib/model-provider-http-api.mjs';

const calls = [];
const chunks = [Buffer.from('data: one\n\n'), Buffer.from('data: [DONE]\n\n')];
const provider = {
  async listModels({ signal }) {
    calls.push(['models', signal]);
    return { ok: true, status: 200, value: { models: ['nvidia/a', 'local:qwen'] } };
  },
  async stream(payload, options) {
    calls.push(['stream', payload, options]);
    return {
      ok: true,
      status: 200,
      value: {
        provider: payload.model.startsWith('local:') ? 'local' : 'nvidia',
        body: (async function* () { for (const chunk of chunks) yield chunk; })()
      }
    };
  }
};
let readCount = 0;
const api = createModelProviderHttpApi({
  provider,
  async readJson(request) { readCount += 1; return request.body; },
  async prepareChat(body) {
    return {
      payload: { model: body.model, messages: [{ role: 'user', content: body.text }], stream: true, max_tokens: 128 },
      headers: { 'X-Hafize-Trace-Id': 'trace-safe' }
    };
  }
});

const controller = new AbortController();
const models = await api.handle({ method: 'GET', pathname: '/api/models', signal: controller.signal });
assert.equal(models.matched, true);
assert.equal(models.kind, 'json');
assert.deepEqual(models.body.models, ['nvidia/a', 'local:qwen']);
assert.equal(readCount, 0);
assert.equal(calls[0][1], controller.signal);

const chat = await api.handle({
  request: { body: { model: 'local:qwen', text: 'Merhaba' } },
  method: 'POST',
  pathname: '/api/chat',
  headers: { authorization: 'Bearer browser-auth' },
  signal: controller.signal
});
assert.equal(chat.kind, 'stream');
assert.equal(chat.provider, 'local');
assert.equal(chat.headers['Content-Type'], 'text/event-stream; charset=utf-8');
assert.equal(chat.headers['X-Hafize-Trace-Id'], 'trace-safe');
assert.equal('Authorization' in chat.headers, false);
assert.equal(calls[1][1].stream, true);
assert.equal(calls[1][2].toolsRequired, false);
assert.equal(calls[1][2].signal, controller.signal);
let streamed = '';
for await (const chunk of chat.body) streamed += chunk.toString();
assert.match(streamed, /data: one/);

assert.deepEqual(await api.handle({ method: 'GET', pathname: '/other' }), { matched: false });
const wrongModels = await api.handle({ method: 'POST', pathname: '/api/models' });
assert.equal(wrongModels.status, 405);
assert.equal(wrongModels.body.error, 'METHOD_NOT_ALLOWED');
const wrongChat = await api.handle({ method: 'GET', pathname: '/api/chat' });
assert.equal(wrongChat.status, 405);

console.log('model provider http api tests passed');
