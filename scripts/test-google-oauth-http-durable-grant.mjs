import assert from 'node:assert/strict';
import { createGoogleOAuthHttpRuntime, GOOGLE_OAUTH_HTTP_PATHS } from '../lib/google-oauth-http-runtime.mjs';
import { createOAuthFlowStore } from '../lib/oauth-flow-store.mjs';

const TOKEN = 'd'.repeat(48);
const ENV = {
  HAFIZE_GOOGLE_OAUTH_REDIRECT_URI: 'https://hafize.example.test/api/connectors/gmail/oauth/callback',
  HAFIZE_GOOGLE_OAUTH_CLIENT_ID: 'client-id',
  HAFIZE_CONNECTOR_AUTH_TOKEN: TOKEN,
  HAFIZE_CONNECTOR_AUTH_SUBJECT: 'durable@example.test',
  HAFIZE_CONNECTOR_OWNER_KEY_B64: Buffer.alloc(32, 11).toString('base64'),
  HAFIZE_OAUTH_REDIS_URL: 'rediss://redis.example.test'
};

function callbackUrl(state) {
  return new URL(`https://hafize.example.test${GOOGLE_OAUTH_HTTP_PATHS.callback}?state=${state}&code=authorization-code`);
}

async function makeRuntime({ remove } = {}) {
  const store = createOAuthFlowStore();
  const removals = [];
  const tokenStore = {
    async save() {},
    async remove(input) {
      removals.push(input);
      if (remove) return remove(input);
    }
  };
  const runtime = await createGoogleOAuthHttpRuntime({
    env: ENV,
    readJson: async (request) => request.body,
    createTokenStoreRuntime: () => tokenStore,
    createFlowStoreRuntime: async () => ({ configured: true, store, async close() {} }),
    createTokenExchange: () => ({
      async exchange() {
        return { provider: 'google', refreshTokenStored: false };
      }
    })
  });
  return { runtime, removals };
}

async function start(runtime) {
  const response = await runtime.handle({
    request: { body: { capabilities: ['gmail.read'] } },
    method: 'POST',
    pathname: GOOGLE_OAUTH_HTTP_PATHS.start,
    url: new URL(`https://hafize.example.test${GOOGLE_OAUTH_HTTP_PATHS.start}`),
    headers: { authorization: `Bearer ${TOKEN}` }
  });
  assert.equal(response.status, 200);
  const authorization = new URL(response.body.authorizationUrl);
  assert.equal(authorization.searchParams.get('access_type'), 'offline');
  assert.equal(authorization.searchParams.get('prompt'), 'consent');
  return authorization.searchParams.get('state');
}

{
  const { runtime, removals } = await makeRuntime();
  const state = await start(runtime);
  const response = await runtime.handle({
    method: 'GET', pathname: GOOGLE_OAUTH_HTTP_PATHS.callback, url: callbackUrl(state), headers: {}
  });
  assert.equal(response.status, 409);
  assert.deepEqual(response.body, { error: 'GOOGLE_OAUTH_REAUTH_REQUIRED' });
  assert.equal(removals.length, 1, 'non-durable access token must be removed');
  assert.equal(removals[0].provider, 'google');
  assert.match(removals[0].ownerId, /^owner_[A-Za-z0-9_-]{43}$/);
}

{
  const { runtime } = await makeRuntime({ remove: async () => { throw new Error('storage path secret'); } });
  const state = await start(runtime);
  const response = await runtime.handle({
    method: 'GET', pathname: GOOGLE_OAUTH_HTTP_PATHS.callback, url: callbackUrl(state), headers: {}
  });
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: 'GOOGLE_OAUTH_INTERNAL_ERROR' });
  assert.equal(JSON.stringify(response.body).includes('storage path secret'), false);
}

console.log('Google OAuth HTTP durable-grant tests passed');
