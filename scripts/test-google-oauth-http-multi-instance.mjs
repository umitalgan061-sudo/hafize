import assert from 'node:assert/strict';
import { createGoogleOAuthHttpRuntime, GOOGLE_OAUTH_HTTP_PATHS } from '../lib/google-oauth-http-runtime.mjs';
import { createOAuthFlowStore } from '../lib/oauth-flow-store.mjs';

const TOKEN = 'z'.repeat(48);
const KEY = Buffer.alloc(32, 3).toString('base64');
const sharedStore = createOAuthFlowStore({ now: () => 50_000 });
const base = {
  HAFIZE_GOOGLE_OAUTH_REDIRECT_URI: 'https://hafize.example.test/api/connectors/gmail/oauth/callback',
  HAFIZE_GOOGLE_OAUTH_CLIENT_ID: 'client-id',
  HAFIZE_CONNECTOR_AUTH_TOKEN: TOKEN,
  HAFIZE_CONNECTOR_OWNER_KEY_B64: KEY,
  HAFIZE_OAUTH_REDIS_URL: 'rediss://shared.example.test'
};
const exchanges = [];

function makeRuntime(subject, instance) {
  return createGoogleOAuthHttpRuntime({
    env: { ...base, HAFIZE_CONNECTOR_AUTH_SUBJECT: subject },
    readJson: async (request) => request.body,
    createAuthenticator: ({ token, subject: configuredSubject }) => ({
      authenticate({ headers }) {
        return headers.authorization === `Bearer ${token}`
          ? { ok: true, principal: { authenticated: true, subject: configuredSubject } }
          : { ok: false, error: 'AUTH_REQUIRED' };
      }
    }),
    createOwnerResolver: () => ({ resolve(principal) { return { ownerId: `owner_${principal.subject}` }; } }),
    createTokenStoreRuntime: () => ({ async save() {} }),
    createFlowStoreRuntime: async () => ({ configured: true, store: sharedStore, async close() {} }),
    createTokenExchange: () => ({
      async exchange(input) { exchanges.push({ ...input, instance }); return { ownerId: input.ownerId, refreshTokenStored: true }; }
    })
  });
}

const instanceA = await makeRuntime('alpha', 'A');
const instanceB = await makeRuntime('bravo', 'B');
const started = await instanceA.handle({
  request: { body: { capabilities: ['gmail.read'] } },
  method: 'POST', pathname: GOOGLE_OAUTH_HTTP_PATHS.start,
  url: new URL(`https://hafize.example.test${GOOGLE_OAUTH_HTTP_PATHS.start}`),
  headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }
});
assert.equal(started.status, 200);
const state = new URL(started.body.authorizationUrl).searchParams.get('state');
assert.equal(sharedStore.size(), 1);

const callbackOnB = await instanceB.handle({
  method: 'GET', pathname: GOOGLE_OAUTH_HTTP_PATHS.callback,
  url: new URL(`https://hafize.example.test${GOOGLE_OAUTH_HTTP_PATHS.callback}?state=${state}&code=code-from-google`),
  headers: {}
});
assert.equal(callbackOnB.status, 200);
assert.deepEqual(callbackOnB.body, { linked: true });
assert.equal(exchanges.length, 1);
assert.equal(exchanges[0].instance, 'B', 'load balancer may send callback to another instance');
assert.equal(exchanges[0].ownerId, 'owner_alpha', 'callback must retain the principal that initiated authorization');
assert.notEqual(exchanges[0].ownerId, 'owner_bravo');
assert.equal(exchanges[0].requireRefreshToken, true);
assert.equal(sharedStore.size(), 0);

const replayOnA = await instanceA.handle({
  method: 'GET', pathname: GOOGLE_OAUTH_HTTP_PATHS.callback,
  url: new URL(`https://hafize.example.test${GOOGLE_OAUTH_HTTP_PATHS.callback}?state=${state}&code=code-from-google`),
  headers: { authorization: `Bearer ${TOKEN}` }
});
assert.equal(replayOnA.status, 400);
assert.equal(exchanges.length, 1);

await instanceA.close();
await instanceB.close();
console.log('Google OAuth HTTP multi-instance tests passed');
