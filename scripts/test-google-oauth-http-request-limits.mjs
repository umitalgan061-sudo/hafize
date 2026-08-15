import assert from 'node:assert/strict';
import {
  createGoogleOAuthHttpRuntime,
  GOOGLE_OAUTH_HTTP_LIMITS,
  GOOGLE_OAUTH_HTTP_PATHS
} from '../lib/google-oauth-http-runtime.mjs';
import { createOAuthFlowStore } from '../lib/oauth-flow-store.mjs';

const TOKEN = 'l'.repeat(48);
const ENV = {
  HAFIZE_GOOGLE_OAUTH_REDIRECT_URI: 'https://hafize.example.test/api/connectors/gmail/oauth/callback',
  HAFIZE_GOOGLE_OAUTH_CLIENT_ID: 'client-id',
  HAFIZE_CONNECTOR_AUTH_TOKEN: TOKEN,
  HAFIZE_CONNECTOR_AUTH_SUBJECT: 'limits@example.test',
  HAFIZE_CONNECTOR_OWNER_KEY_B64: Buffer.alloc(32, 13).toString('base64'),
  HAFIZE_OAUTH_REDIS_URL: 'rediss://redis.example.test'
};
const START_URL = new URL(`https://hafize.example.test${GOOGLE_OAUTH_HTTP_PATHS.start}`);

function headers(extra = {}) {
  return {
    authorization: `Bearer ${TOKEN}`,
    'content-type': 'application/json; charset=utf-8',
    ...extra
  };
}

function streamRequest(chunks) {
  let resumed = 0;
  let iterated = 0;
  return {
    get resumed() { return resumed; },
    get iterated() { return iterated; },
    resume() { resumed += 1; },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        iterated += 1;
        yield chunk;
      }
    }
  };
}

function hangingRequest() {
  let resumed = 0;
  let returned = 0;
  return {
    get resumed() { return resumed; },
    get returned() { return returned; },
    resume() { resumed += 1; },
    [Symbol.asyncIterator]() {
      return {
        next() { return new Promise(() => {}); },
        return() { returned += 1; return Promise.resolve({ done: true }); }
      };
    }
  };
}

async function makeRuntime({ startBodyTimeoutMs } = {}) {
  const store = createOAuthFlowStore({ now: () => 5_000 });
  let fallbackReads = 0;
  let exchanges = 0;
  const runtime = await createGoogleOAuthHttpRuntime({
    env: ENV,
    startBodyTimeoutMs,
    readJson: async (request) => {
      fallbackReads += 1;
      return request?.body || {};
    },
    createTokenStoreRuntime: () => ({ async save() {} }),
    createFlowStoreRuntime: async () => ({ configured: true, store, async close() {} }),
    createTokenExchange: () => ({
      async exchange() { exchanges += 1; return { refreshTokenStored: true }; }
    })
  });
  return { runtime, store, get fallbackReads() { return fallbackReads; }, get exchanges() { return exchanges; } };
}

async function start(runtime, request, requestHeaders = headers()) {
  return runtime.handle({
    request,
    method: 'POST',
    pathname: GOOGLE_OAUTH_HTTP_PATHS.start,
    url: START_URL,
    headers: requestHeaders
  });
}

{
  const state = await makeRuntime();
  const request = streamRequest([
    Buffer.from('{"capabilities":'),
    Buffer.from('["gmail.read"]}')
  ]);
  const response = await start(state.runtime, request, headers({ 'content-length': '31' }));
  assert.equal(response.status, 200);
  assert.equal(state.fallbackReads, 0, 'real streams must use the OAuth-specific bounded reader');
  assert.equal(request.iterated, 2);
}

{
  const state = await makeRuntime();
  const request = streamRequest([Buffer.from('{}')]);
  const response = await start(state.runtime, request, headers({
    'content-length': String(GOOGLE_OAUTH_HTTP_LIMITS.maxStartBodyBytes + 1)
  }));
  assert.equal(response.status, 413);
  assert.deepEqual(response.body, { error: 'BODY_TOO_LARGE' });
  assert.deepEqual(response.headers, { Connection: 'close' });
  assert.equal(request.iterated, 0, 'declared oversize must be rejected before body I/O');
}

{
  const state = await makeRuntime();
  const request = streamRequest([
    Buffer.alloc(GOOGLE_OAUTH_HTTP_LIMITS.maxStartBodyBytes, 0x20),
    Buffer.from('x')
  ]);
  const response = await start(state.runtime, request, headers());
  assert.equal(response.status, 413);
  assert.equal(request.iterated, 2, 'chunked body must be measured as it arrives');
  assert.equal(request.resumed, 1, 'oversized streaming request is drained while response closes the connection');
}

{
  const state = await makeRuntime({ startBodyTimeoutMs: 5 });
  const request = hangingRequest();
  const response = await start(state.runtime, request, headers());
  assert.equal(response.status, 408);
  assert.deepEqual(response.body, { error: 'REQUEST_TIMEOUT' });
  assert.deepEqual(response.headers, { Connection: 'close' });
  assert.equal(request.returned, 1, 'timed-out iterator must be cancelled');
  assert.equal(request.resumed, 1);
}

{
  const state = await makeRuntime();
  const response = await start(state.runtime, { body: { capabilities: ['gmail.read'] } }, {
    authorization: `Bearer ${TOKEN}`,
    'content-type': 'text/plain'
  });
  assert.equal(response.status, 415);
  assert.deepEqual(response.body, { error: 'UNSUPPORTED_MEDIA_TYPE' });
  assert.equal(state.store.size(), 0);
}

{
  const state = await makeRuntime();
  const response = await start(state.runtime, streamRequest([Buffer.from('{bad-json')]), headers());
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: 'INVALID_JSON' });
  assert.equal(state.store.size(), 0);
}

{
  const state = await makeRuntime();
  const response = await start(state.runtime, { body: { capabilities: ['gmail.read'] } }, headers({ 'content-length': 'abc' }));
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: 'INVALID_OAUTH_REQUEST' });
  assert.equal(state.store.size(), 0);
}

{
  const state = await makeRuntime();
  const started = await start(state.runtime, { body: { capabilities: ['gmail.read'] } }, headers());
  assert.equal(started.status, 200);
  const oauthState = new URL(started.body.authorizationUrl).searchParams.get('state');
  assert.equal(state.store.size(), 1);

  const hugeQuery = new URL(`https://hafize.example.test${GOOGLE_OAUTH_HTTP_PATHS.callback}`);
  hugeQuery.searchParams.set('state', oauthState);
  hugeQuery.searchParams.set('code', 'authorization-code');
  hugeQuery.searchParams.set('error_description', 'x'.repeat(GOOGLE_OAUTH_HTTP_LIMITS.maxCallbackQueryBytes));
  const rejected = await state.runtime.handle({
    method: 'GET', pathname: GOOGLE_OAUTH_HTTP_PATHS.callback, url: hugeQuery, headers: {}
  });
  assert.equal(rejected.status, 400);
  assert.equal(state.store.size(), 1, 'oversized callback must fail before one-time state consumption');
  assert.equal(state.exchanges, 0);

  const valid = await state.runtime.handle({
    method: 'GET',
    pathname: GOOGLE_OAUTH_HTTP_PATHS.callback,
    url: new URL(`https://hafize.example.test${GOOGLE_OAUTH_HTTP_PATHS.callback}?state=${oauthState}&code=authorization-code`),
    headers: {}
  });
  assert.equal(valid.status, 200);
  assert.equal(state.store.size(), 0);
  assert.equal(state.exchanges, 1);
}

console.log('Google OAuth HTTP request-limit tests passed');
