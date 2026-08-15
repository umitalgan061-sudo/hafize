import assert from 'node:assert/strict';
import { createModelProviderHttpApi } from '../lib/model-provider-http-api.mjs';

function createApi({ readJson, prepareChat }) {
  return createModelProviderHttpApi({
    provider: {
      async listModels() { return { ok: true, value: { models: [] } }; },
      async stream() { throw new Error('stream must not run after preparation failure'); }
    },
    readJson,
    prepareChat
  });
}

async function chat(api, signal = null) {
  return api.handle({
    request: {},
    method: 'POST',
    pathname: '/api/chat',
    signal
  });
}

for (const [error, status, code] of [
  [Object.assign(new Error('INVALID_CHAT_REQUEST'), { code: 'INVALID_CHAT_REQUEST' }), 400, 'INVALID_CHAT_REQUEST'],
  [Object.assign(new Error('INVALID_AGENT'), { code: 'INVALID_AGENT' }), 400, 'INVALID_AGENT'],
  [new SyntaxError('private JSON detail'), 400, 'INVALID_JSON'],
  [Object.assign(new Error('BODY_TOO_LARGE'), { code: 'BODY_TOO_LARGE' }), 413, 'BODY_TOO_LARGE'],
  [Object.assign(new Error('LOCAL_CONTEXT_COMPACTION_UNAVAILABLE'), { code: 'LOCAL_CONTEXT_COMPACTION_UNAVAILABLE' }), 413, 'LOCAL_CONTEXT_COMPACTION_UNAVAILABLE']
]) {
  const api = createApi({
    async readJson() { if (error instanceof SyntaxError || error.code === 'BODY_TOO_LARGE') throw error; return {}; },
    async prepareChat() { throw error; }
  });
  const result = await chat(api);
  assert.equal(result.status, status);
  assert.deepEqual(result.body, { error: code });
  assert.equal(JSON.stringify(result).includes('private JSON detail'), false);
}

const unknown = createApi({
  async readJson() { return {}; },
  async prepareChat() { throw new Error('/Users/private/.env bearer-secret'); }
});
const unknownResult = await chat(unknown);
assert.equal(unknownResult.status, 500);
assert.deepEqual(unknownResult.body, { error: 'CHAT_PREPARATION_FAILED' });
assert.equal(JSON.stringify(unknownResult).includes('/Users/private'), false);
assert.equal(JSON.stringify(unknownResult).includes('bearer-secret'), false);

const controller = new AbortController();
controller.abort();
const cancelled = createApi({
  async readJson() { return {}; },
  async prepareChat() { throw new Error('anything'); }
});
const cancelledResult = await chat(cancelled, controller.signal);
assert.equal(cancelledResult.status, 499);
assert.deepEqual(cancelledResult.body, { error: 'MODEL_PROVIDER_CANCELLED' });

console.log('model provider http preparation error tests passed');
