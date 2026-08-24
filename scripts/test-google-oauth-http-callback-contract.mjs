import assert from 'node:assert/strict';
import { createGoogleOAuthHttpRuntime, GOOGLE_OAUTH_HTTP_PATHS } from '../lib/google-oauth-http-runtime.mjs';
import { createOAuthFlowStore } from '../lib/oauth-flow-store.mjs';

const store = createOAuthFlowStore({ now: () => 1_000 });
let exchanges = 0;
const runtime = await createGoogleOAuthHttpRuntime({
  env: {
    HAFIZE_GOOGLE_OAUTH_REDIRECT_URI: 'https://hafize.example.test/api/connectors/gmail/oauth/callback',
    HAFIZE_GOOGLE_OAUTH_CLIENT_ID: 'client',
    HAFIZE_CONNECTOR_OWNER_KEY_B64: Buffer.alloc(32, 4).toString('base64'),
    HAFIZE_OAUTH_REDIS_URL: 'rediss://redis.example.test',
    HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example.test'
  },
  readJson: async () => ({ capabilities: ['gmail.read'] }),
  createSessionRuntime: () => ({
    configured: true,
    authenticator: {
      authenticate: () => ({ ok: true, principal: { authenticated: true, subject: 'subject' } })
    }
  }),
  createTokenStoreRuntime: () => ({ async save() {} }),
  createFlowStoreRuntime: async () => ({ configured: true, store, async close() {} }),
  createTokenExchange: () => ({ async exchange() { exchanges += 1; return { refreshTokenStored: true }; } })
});
const started = await runtime.handle({
  request: {}, method: 'POST', pathname: GOOGLE_OAUTH_HTTP_PATHS.start,
  url: new URL(`https://hafize.example.test${GOOGLE_OAUTH_HTTP_PATHS.start}`),
  headers: { origin: 'https://hafize.example.test', 'content-type': 'application/json' }
});
const state = new URL(started.body.authorizationUrl).searchParams.get('state');
const base = `https://hafize.example.test${GOOGLE_OAUTH_HTTP_PATHS.callback}?state=${state}`;

for (const suffix of ['&code=authorization-code&next=evil', '', '&code=authorization-code&error=access_denied']) {
  const response = await runtime.handle({ method: 'GET', pathname: GOOGLE_OAUTH_HTTP_PATHS.callback, url: new URL(`${base}${suffix}`), headers: {} });
  assert.equal(response.status, 400);
  assert.equal(store.size(), 1, 'invalid callback contract must be rejected before one-time state consumption');
  assert.equal(exchanges, 0);
}
const valid = await runtime.handle({ method: 'GET', pathname: GOOGLE_OAUTH_HTTP_PATHS.callback, url: new URL(`${base}&code=authorization-code`), headers: {} });
assert.equal(valid.status, 200);
assert.equal(store.size(), 0);
assert.equal(exchanges, 1);
console.log('Google OAuth HTTP callback-contract tests passed');
