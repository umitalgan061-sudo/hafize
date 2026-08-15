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

async function makeRuntime({ existingRefreshToken = null, providerRefreshToken = null } = {}) {
  const store = createOAuthFlowStore();
  const saves = [];
  const removals = [];
  const tokenStore = {
    async load() {
      return existingRefreshToken ? { refreshToken: existingRefreshToken } : null;
    },
    async save(input) { saves.push(input); },
    async remove(input) {
      removals.push(input);
      throw new Error('OAuth HTTP callback must not use post-save cleanup');
    }
  };
  const runtime = await createGoogleOAuthHttpRuntime({
    env: ENV,
    readJson: async (request) => request.body,
    createTokenStoreRuntime: () => tokenStore,
    createFlowStoreRuntime: async () => ({ configured: true, store, async close() {} }),
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          access_token: 'access-token',
          ...(providerRefreshToken ? { refresh_token: providerRefreshToken } : {}),
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'https://www.googleapis.com/auth/gmail.readonly'
        };
      }
    })
  });
  return { runtime, saves, removals };
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

async function callback(runtime, state) {
  return runtime.handle({
    method: 'GET',
    pathname: GOOGLE_OAUTH_HTTP_PATHS.callback,
    url: callbackUrl(state),
    headers: {}
  });
}

{
  const { runtime, saves, removals } = await makeRuntime();
  const response = await callback(runtime, await start(runtime));
  assert.equal(response.status, 409);
  assert.deepEqual(response.body, { linked: false, error: 'GOOGLE_OAUTH_REAUTH_REQUIRED' });
  assert.equal(saves.length, 0, 'access-only grant must be rejected before encrypted token-store mutation');
  assert.equal(removals.length, 0, 'pre-save rejection must not rely on destructive cleanup');
}

{
  const { runtime, saves, removals } = await makeRuntime({ existingRefreshToken: 'existing-refresh-token' });
  const response = await callback(runtime, await start(runtime));
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { linked: true });
  assert.equal(saves.length, 1);
  assert.equal(saves[0].tokenRecord.refreshToken, 'existing-refresh-token', 'same-owner durable grant must survive reauthorization');
  assert.equal(removals.length, 0);
}

{
  const { runtime, saves, removals } = await makeRuntime({ providerRefreshToken: 'new-refresh-token' });
  const response = await callback(runtime, await start(runtime));
  assert.equal(response.status, 200);
  assert.equal(saves.length, 1);
  assert.equal(saves[0].tokenRecord.refreshToken, 'new-refresh-token');
  assert.equal(removals.length, 0);
}

console.log('Google OAuth HTTP durable-grant tests passed');
