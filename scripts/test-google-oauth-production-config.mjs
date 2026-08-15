import assert from 'node:assert/strict';
import { createGoogleOAuthNodeServerRuntime, GOOGLE_OAUTH_SERVER_ENV } from '../lib/google-oauth-node-server-runtime.mjs';

const env = {
  HAFIZE_CONNECTOR_AUTH_TOKEN: 't'.repeat(48),
  HAFIZE_CONNECTOR_AUTH_SUBJECT: 'oauth-user@example.test',
  HAFIZE_CONNECTOR_OWNER_KEY_B64: Buffer.alloc(32, 23).toString('base64'),
  HAFIZE_GOOGLE_OAUTH_CLIENT_ID: 'client-123',
  HAFIZE_GOOGLE_OAUTH_CLIENT_SECRET: 'secret-optional',
  HAFIZE_GOOGLE_OAUTH_REDIRECT_URI: 'https://hafize.example.test/api/connectors/gmail/oauth/callback',
  HAFIZE_OAUTH_FLOW_REDIS_URL: 'rediss://flow.example.test:6380/0',
  HAFIZE_OAUTH_TOKEN_REDIS_URL: 'rediss://tokens.example.test:6380/0',
  HAFIZE_OAUTH_TOKEN_KEY_B64: Buffer.alloc(32, 29).toString('base64')
};
let factoryCalls = 0;
const factories = {
  fetchImpl: async () => {},
  createAuthenticator: () => { factoryCalls += 1; return { authenticate: () => ({ ok: false }) }; },
  createOwnerResolver: () => ({ resolve: () => ({ ownerId: 'owner_test' }) }),
  createFlowStoreRuntime: () => ({ issue: async () => {}, consume: async () => {}, close: async () => {} }),
  createFlowRuntime: () => ({ start: async () => ({}), finish: async () => ({}), close: async () => {} }),
  createTokenStoreRuntime: () => ({ status: () => ({ storage: 'encrypted-redis' }), save: async () => {}, close: async () => {} }),
  createTokenExchange: () => ({ exchange: async () => ({ scopes: [], expiresAt: 0 }) })
};
const runtime = createGoogleOAuthNodeServerRuntime({ env, ...factories });
assert.equal(runtime.configured, true);
assert.equal(factoryCalls, 1);
await runtime.close();

for (const name of [
  'HAFIZE_CONNECTOR_AUTH_TOKEN',
  'HAFIZE_CONNECTOR_AUTH_SUBJECT',
  'HAFIZE_CONNECTOR_OWNER_KEY_B64',
  'HAFIZE_GOOGLE_OAUTH_CLIENT_ID',
  'HAFIZE_GOOGLE_OAUTH_REDIRECT_URI',
  'HAFIZE_OAUTH_FLOW_REDIS_URL'
]) {
  const partial = { ...env };
  delete partial[name];
  assert.throws(() => createGoogleOAuthNodeServerRuntime({ env: partial, ...factories }), /INVALID_GOOGLE_OAUTH_SERVER_RUNTIME/);
}
const noSecret = { ...env };
delete noSecret.HAFIZE_GOOGLE_OAUTH_CLIENT_SECRET;
assert.equal(createGoogleOAuthNodeServerRuntime({ env: noSecret, ...factories }).configured, true);

factoryCalls = 0;
const disabled = createGoogleOAuthNodeServerRuntime({
  env: {
    HAFIZE_CONNECTOR_AUTH_TOKEN: env.HAFIZE_CONNECTOR_AUTH_TOKEN,
    HAFIZE_CONNECTOR_AUTH_SUBJECT: env.HAFIZE_CONNECTOR_AUTH_SUBJECT,
    HAFIZE_CONNECTOR_OWNER_KEY_B64: env.HAFIZE_CONNECTOR_OWNER_KEY_B64
  },
  ...factories
});
assert.equal(disabled.configured, false);
assert.equal(factoryCalls, 0);
assert.deepEqual(GOOGLE_OAUTH_SERVER_ENV, {
  authToken: 'HAFIZE_CONNECTOR_AUTH_TOKEN', authSubject: 'HAFIZE_CONNECTOR_AUTH_SUBJECT', ownerKey: 'HAFIZE_CONNECTOR_OWNER_KEY_B64',
  clientId: 'HAFIZE_GOOGLE_OAUTH_CLIENT_ID', clientSecret: 'HAFIZE_GOOGLE_OAUTH_CLIENT_SECRET',
  redirectUri: 'HAFIZE_GOOGLE_OAUTH_REDIRECT_URI', flowRedisUrl: 'HAFIZE_OAUTH_FLOW_REDIS_URL'
});

console.log('Google OAuth production config tests passed');
