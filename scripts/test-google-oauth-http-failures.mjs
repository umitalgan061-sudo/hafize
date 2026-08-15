import assert from 'node:assert/strict';
import { createGoogleOAuthHttpRuntime, GOOGLE_OAUTH_HTTP_PATHS } from '../lib/google-oauth-http-runtime.mjs';
import { createOAuthFlowStore } from '../lib/oauth-flow-store.mjs';

const TOKEN = 'q'.repeat(48);
const ENV = {
  HAFIZE_GOOGLE_OAUTH_REDIRECT_URI: 'https://hafize.example.test/api/connectors/gmail/oauth/callback',
  HAFIZE_GOOGLE_OAUTH_CLIENT_ID: 'client-id',
  HAFIZE_CONNECTOR_AUTH_TOKEN: TOKEN,
  HAFIZE_CONNECTOR_AUTH_SUBJECT: 'subject',
  HAFIZE_CONNECTOR_OWNER_KEY_B64: Buffer.alloc(32, 9).toString('base64'),
  HAFIZE_OAUTH_REDIS_URL: 'rediss://redis.example.test'
};
const startUrl = new URL(`https://hafize.example.test${GOOGLE_OAUTH_HTTP_PATHS.start}`);
const headers = { authorization: `Bearer ${TOKEN}` };

async function createRuntime({ store = createOAuthFlowStore(), exchange, readJson, close } = {}) {
  return createGoogleOAuthHttpRuntime({
    env: ENV,
    readJson: readJson || (async (request) => request.body),
    createTokenStoreRuntime: () => ({ async save() {} }),
    createFlowStoreRuntime: async () => ({ configured: true, store, close: close || (async () => {}) }),
    createTokenExchange: () => ({ exchange: exchange || (async () => ({ ownerId: 'owner' })) })
  });
}

async function start(runtime) {
  const response = await runtime.handle({
    request: { body: { capabilities: ['gmail.read'] } }, method: 'POST', pathname: GOOGLE_OAUTH_HTTP_PATHS.start,
    url: startUrl, headers
  });
  assert.equal(response.status, 200);
  return new URL(response.body.authorizationUrl).searchParams.get('state');
}

async function callback(runtime, state) {
  return runtime.handle({
    method: 'GET', pathname: GOOGLE_OAUTH_HTTP_PATHS.callback,
    url: new URL(`https://hafize.example.test${GOOGLE_OAUTH_HTTP_PATHS.callback}?state=${state}&code=authorization-code`),
    headers: {}
  });
}

{
  const store = {
    async issue() { const error = new Error('redis socket secret'); error.code = 'OAUTH_FLOW_STORE_UNAVAILABLE'; throw error; },
    async consume() { throw new Error('unused'); }
  };
  const runtime = await createRuntime({ store });
  const response = await runtime.handle({ request: { body: { capabilities: ['gmail.read'] } }, method: 'POST', pathname: GOOGLE_OAUTH_HTTP_PATHS.start, url: startUrl, headers });
  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { error: 'OAUTH_TEMPORARILY_UNAVAILABLE' });
  assert.equal(JSON.stringify(response.body).includes('socket secret'), false);
}

for (const [code, expectedStatus, expectedError] of [
  ['GOOGLE_TOKEN_EXCHANGE_FAILED:timeout', 504, 'GOOGLE_OAUTH_UPSTREAM_TIMEOUT'],
  ['GOOGLE_TOKEN_EXCHANGE_FAILED:network', 502, 'GOOGLE_OAUTH_UPSTREAM_FAILED'],
  ['GOOGLE_TOKEN_EXCHANGE_SCOPE_ESCALATION', 502, 'GOOGLE_OAUTH_UPSTREAM_FAILED']
]) {
  const runtime = await createRuntime({ exchange: async () => { const error = new Error('provider detail'); error.code = code; throw error; } });
  const state = await start(runtime);
  const response = await callback(runtime, state);
  assert.equal(response.status, expectedStatus);
  assert.deepEqual(response.body, { error: expectedError });
  assert.equal(JSON.stringify(response.body).includes('provider detail'), false);
  assert.equal((await callback(runtime, state)).status, 400, 'failed exchange still burns the one-time callback flow');
}

{
  const runtime = await createRuntime({ exchange: async () => { throw new Error('token store path /secret'); } });
  const response = await callback(runtime, await start(runtime));
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: 'GOOGLE_OAUTH_INTERNAL_ERROR' });
  assert.equal(JSON.stringify(response.body).includes('/secret'), false);
}

{
  const runtime = await createRuntime({ readJson: async () => { throw new SyntaxError('bad json detail'); } });
  const response = await runtime.handle({ request: {}, method: 'POST', pathname: GOOGLE_OAUTH_HTTP_PATHS.start, url: startUrl, headers });
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: 'INVALID_JSON' });
}

{
  let closes = 0;
  await assert.rejects(() => createGoogleOAuthHttpRuntime({
    env: ENV,
    readJson: async () => ({}),
    createTokenStoreRuntime: () => ({ async save() {} }),
    createFlowStoreRuntime: async () => ({ configured: true, store: createOAuthFlowStore(), async close() { closes += 1; } }),
    createOAuthRuntime: () => { throw new Error('composition secret'); }
  }), (error) => error?.code === 'GOOGLE_OAUTH_HTTP_RUNTIME_STARTUP_FAILED' && !error.message.includes('secret'));
  assert.equal(closes, 1, 'failed composition must close the already-started Redis flow runtime');
}

{
  const runtime = await createRuntime({ close: async () => { throw new Error('redis close secret'); } });
  const closeA = runtime.close();
  const closeB = runtime.close();
  assert.strictEqual(closeA, closeB);
  await assert.rejects(closeA, (error) => error?.code === 'GOOGLE_OAUTH_HTTP_RUNTIME_CLOSE_FAILED' && !error.message.includes('secret'));
}

console.log('Google OAuth HTTP failure-mode tests passed');
