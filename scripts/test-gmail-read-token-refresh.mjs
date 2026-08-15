import assert from 'node:assert/strict';
import { createGmailReadClient } from '../lib/gmail-read-client.mjs';
import { createGmailAgentRuntime } from '../lib/gmail-agent-runtime.mjs';

const READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const OWNER = 'owner_gmail_refresh';
let record = {
  accessToken: 'expired-access-token-0000000000',
  refreshToken: 'refresh-token-0000000000000000',
  tokenType: 'Bearer',
  scopes: [READ_SCOPE],
  expiresAt: 10_000
};
const tokenStore = {
  async load({ ownerId, provider }) {
    assert.equal(ownerId, OWNER);
    assert.equal(provider, 'google');
    return structuredClone(record);
  }
};
let refreshCalls = 0;
let gmailCalls = 0;
const client = createGmailReadClient({
  tokenStore,
  now: () => 100_000,
  async refreshAccessToken({ ownerId }) {
    refreshCalls += 1;
    assert.equal(ownerId, OWNER);
    record = { ...record, accessToken: 'fresh-access-token-111111111111', expiresAt: 3_700_000 };
  },
  async fetchImpl(url, init) {
    gmailCalls += 1;
    assert.equal(url, 'https://gmail.googleapis.com/gmail/v1/users/me/profile');
    assert.equal(init.headers.authorization, 'Bearer fresh-access-token-111111111111');
    return { ok: true, async json() { return { emailAddress: 'owner@example.test', messagesTotal: 42 }; } };
  }
});
const profile = await client.read({ ownerId: OWNER, operation: 'profile.get' });
assert.equal(profile.messagesTotal, 42);
assert.equal(refreshCalls, 1);
assert.equal(gmailCalls, 1);

let noRefreshFetches = 0;
const noRefresh = createGmailReadClient({
  tokenStore: { async load() { return { ...record, accessToken: 'expired-access-token-2222222222', expiresAt: 1 }; } },
  now: () => 100_000,
  fetchImpl: async () => { noRefreshFetches += 1; throw new Error('Gmail must not run'); }
});
await assert.rejects(
  () => noRefresh.read({ ownerId: OWNER, operation: 'profile.get' }),
  /GMAIL_READ_REAUTH_REQUIRED/
);
assert.equal(noRefreshFetches, 0);

let failedRefreshFetches = 0;
const failedRefresh = createGmailReadClient({
  tokenStore: { async load() { return { ...record, accessToken: 'expired-access-token-3333333333', expiresAt: 1 }; } },
  now: () => 100_000,
  refreshAccessToken: async () => { throw new Error('provider detail must be hidden'); },
  fetchImpl: async () => { failedRefreshFetches += 1; throw new Error('Gmail must not run'); }
});
await assert.rejects(
  () => failedRefresh.read({ ownerId: OWNER, operation: 'profile.get' }),
  (error) => error?.message === 'GMAIL_READ_REAUTH_REQUIRED'
);
assert.equal(failedRefreshFetches, 0);

const secret = Buffer.alloc(32, 9).toString('base64');
const env = {
  HAFIZE_CONNECTOR_AUTH_TOKEN: 'a'.repeat(40),
  HAFIZE_CONNECTOR_AUTH_SUBJECT: 'owner@example.test',
  HAFIZE_CONNECTOR_OWNER_KEY_B64: secret,
  HAFIZE_GOOGLE_OAUTH_CLIENT_ID: 'google-client-id.apps.example',
  HAFIZE_GOOGLE_OAUTH_CLIENT_SECRET: 'server-only-google-secret'
};
let refreshFactoryInput = null;
let readFactoryInput = null;
const runtime = createGmailAgentRuntime({
  env,
  fetchImpl: async () => { throw new Error('network must remain unused during composition'); },
  createAuthenticator: () => ({ authenticate: () => ({ ok: true, principal: { authenticated: true, subject: 'owner@example.test' } }) }),
  createOwnerResolver: () => ({ resolve: () => ({ ownerId: OWNER }) }),
  createTokenStoreRuntime: () => tokenStore,
  createTokenRefresh(input) {
    refreshFactoryInput = input;
    return { refresh: async () => ({ provider: 'google' }) };
  },
  createReadClient(input) {
    readFactoryInput = input;
    return { read: async () => ({ ok: true }) };
  },
  createBoundary: () => ({ execute: async () => ({ ok: true }) })
});
assert.equal(runtime.configured, true);
assert.equal(refreshFactoryInput.clientId, env.HAFIZE_GOOGLE_OAUTH_CLIENT_ID);
assert.equal(refreshFactoryInput.clientSecret, env.HAFIZE_GOOGLE_OAUTH_CLIENT_SECRET);
assert.strictEqual(refreshFactoryInput.tokenStore, tokenStore);
assert.equal(typeof readFactoryInput.refreshAccessToken, 'function');
assert.equal(JSON.stringify(runtime).includes(env.HAFIZE_GOOGLE_OAUTH_CLIENT_SECRET), false);
assert.throws(
  () => createGmailAgentRuntime({
    env: { ...env, HAFIZE_GOOGLE_OAUTH_CLIENT_ID: '' },
    createTokenStoreRuntime: () => tokenStore
  }),
  /INVALID_GMAIL_AGENT_RUNTIME:googleOAuthConfig/
);

console.log('gmail read token refresh integration tests passed');
