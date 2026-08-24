import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { createGoogleOAuthHttpRuntime } from '../lib/google-oauth-http-runtime.mjs';
import { createOAuthFlowStore } from '../lib/oauth-flow-store.mjs';

const password = 'deployment password value';
const salt = Buffer.alloc(16, 0x19);
const digest = scryptSync(password, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const completeSession = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}`,
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: Buffer.alloc(32, 0x41).toString('base64url'),
  HAFIZE_CLOUD_SESSION_SUBJECT: 'deploy@example.test',
  HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example.test'
};
const oauth = {
  HAFIZE_GOOGLE_OAUTH_REDIRECT_URI: 'https://hafize.example.test/api/connectors/gmail/oauth/callback',
  HAFIZE_GOOGLE_OAUTH_CLIENT_ID: 'deploy-client.apps.googleusercontent.com',
  HAFIZE_GOOGLE_OAUTH_CLIENT_SECRET: 'deploy-secret',
  HAFIZE_CONNECTOR_OWNER_KEY_B64: Buffer.alloc(32, 0x61).toString('base64'),
  HAFIZE_OAUTH_REDIS_URL: 'rediss://redis.example.test:6380'
};

function dependencies() {
  return {
    readJson: async (request) => request?.body || {},
    createTokenStoreRuntime: () => ({ async save() {} }),
    createFlowStoreRuntime: async () => ({
      configured: true,
      store: createOAuthFlowStore(),
      async close() {}
    }),
    createTokenExchange: () => ({ async exchange() { return { refreshTokenStored: true }; } })
  };
}

const disabled = await createGoogleOAuthHttpRuntime({ env: completeSession, readJson: async () => ({}) });
assert.equal(disabled.configured, false, 'cloud session alone must not expose Google OAuth routes');

await assert.rejects(
  () => createGoogleOAuthHttpRuntime({ env: oauth, ...dependencies() }),
  /INVALID_GOOGLE_OAUTH_HTTP_RUNTIME:HAFIZE_CLOUD_SESSION_ORIGIN/,
  'configured OAuth must fail closed when cloud-session origin is absent'
);

for (const missing of Object.keys(completeSession)) {
  const partial = { ...oauth, ...completeSession };
  delete partial[missing];
  await assert.rejects(
    () => createGoogleOAuthHttpRuntime({ env: partial, ...dependencies() }),
    missing === 'HAFIZE_CLOUD_SESSION_ORIGIN'
      ? /INVALID_GOOGLE_OAUTH_HTTP_RUNTIME:HAFIZE_CLOUD_SESSION_ORIGIN/
      : /INVALID_GOOGLE_OAUTH_HTTP_RUNTIME:cloudSession|INVALID_CLOUD_SESSION_SERVER:partialConfig/,
    `OAuth startup must fail closed without ${missing}`
  );
}

for (const origin of [
  'http://hafize.example.test',
  'https://user@hafize.example.test',
  'https://hafize.example.test/path',
  'https://hafize.example.test/?query=1',
  'https://hafize.example.test/#fragment'
]) {
  await assert.rejects(
    () => createGoogleOAuthHttpRuntime({ env: { ...oauth, ...completeSession, HAFIZE_CLOUD_SESSION_ORIGIN: origin }, ...dependencies() }),
    /INVALID_GOOGLE_OAUTH_HTTP_RUNTIME:HAFIZE_CLOUD_SESSION_ORIGIN/,
    `invalid browser origin must be rejected: ${origin}`
  );
}

const legacyOnly = {
  ...oauth,
  HAFIZE_CONNECTOR_AUTH_TOKEN: 'legacy-token-that-used-to-authenticate-oauth-start-0001',
  HAFIZE_CONNECTOR_AUTH_SUBJECT: 'legacy@example.test'
};
await assert.rejects(
  () => createGoogleOAuthHttpRuntime({ env: legacyOnly, ...dependencies() }),
  /INVALID_GOOGLE_OAUTH_HTTP_RUNTIME:HAFIZE_CLOUD_SESSION_ORIGIN/,
  'legacy connector bearer config must not substitute for cloud-session config'
);

const configured = await createGoogleOAuthHttpRuntime({ env: { ...oauth, ...completeSession }, ...dependencies() });
assert.equal(configured.configured, true);
assert.deepEqual(configured.status(), {
  configured: true,
  provider: 'google',
  callbackPath: '/api/connectors/gmail/oauth/callback'
});
await configured.close();

console.log('Google OAuth cloud-session deployment config tests passed');
