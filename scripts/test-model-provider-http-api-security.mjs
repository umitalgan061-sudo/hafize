import assert from 'node:assert/strict';
import { createModelProviderHttpApi } from '../lib/model-provider-http-api.mjs';

function makeApi({ prepareChat, provider } = {}) {
  return createModelProviderHttpApi({
    provider: provider || {
      listModels: async () => ({ ok: false, status: 502, error: 'MODEL_PROVIDER_FAILED', detail: '/secret/token' }),
      stream: async () => { throw new Error('must not run'); }
    },
    readJson: async (request) => request?.body || {},
    prepareChat: prepareChat || (async () => ({ payload: { model: 'nvidia/model', messages: [{ role: 'user', content: 'x' }], stream: true } }))
  });
}

const failed = await makeApi().handle({ method: 'GET', pathname: '/api/models' });
assert.deepEqual(failed.body, { error: 'MODEL_PROVIDER_FAILED' });
assert.equal(JSON.stringify(failed).includes('/secret/token'), false);

for (const prepared of [
  null,
  { payload: null },
  { payload: { model: '', messages: [], stream: true } },
  { payload: { model: 'x', messages: [], stream: true } },
  { payload: { model: 'x', messages: [{}], stream: false } },
  { payload: { model: 'x', messages: [{}], stream: true, tools: [] } },
  { payload: { model: 'x', messages: [{}], stream: true, tool_choice: 'none' } },
  { payload: { model: 'x', messages: [{}], stream: true }, extra: true }
]) {
  const api = makeApi({ prepareChat: async () => prepared });
  const result = await api.handle({ request: { body: {} }, method: 'POST', pathname: '/api/chat' });
  assert.equal(result.status, 500);
  assert.deepEqual(result.body, { error: 'CHAT_PREPARATION_FAILED' });
}

for (const headers of [
  { Authorization: 'Bearer secret' },
  { Cookie: 'session=secret' },
  { 'Set-Cookie': 'x=y' },
  { 'X-Test': 'ok\r\nInjected: yes' }
]) {
  const api = makeApi({ prepareChat: async () => ({ payload: { model: 'x', messages: [{}], stream: true }, headers }) });
  const result = await api.handle({ request: { body: {} }, method: 'POST', pathname: '/api/chat' });
  assert.equal(result.status, 500);
  assert.deepEqual(result.body, { error: 'CHAT_PREPARATION_FAILED' });
}

const controller = new AbortController();
controller.abort();
let streamCalls = 0;
const cancelled = await makeApi({
  provider: {
    listModels: async () => ({ ok: false, status: 499, error: 'MODEL_PROVIDER_CANCELLED' }),
    stream: async () => { streamCalls += 1; return { ok: false, status: 499, error: 'MODEL_PROVIDER_CANCELLED' }; }
  }
}).handle({ request: { body: {} }, method: 'POST', pathname: '/api/chat', signal: controller.signal });
assert.equal(cancelled.status, 499);
assert.equal(cancelled.body.error, 'MODEL_PROVIDER_CANCELLED');
assert.equal(streamCalls, 1);

assert.throws(() => createModelProviderHttpApi(), /INVALID_MODEL_PROVIDER_HTTP_API:provider/);
assert.throws(() => createModelProviderHttpApi({ provider: { listModels() {}, stream() {} } }), /INVALID_MODEL_PROVIDER_HTTP_API:readJson/);

console.log('model provider http api security tests passed');
