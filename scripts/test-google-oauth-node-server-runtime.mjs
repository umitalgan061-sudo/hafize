import assert from 'node:assert/strict';
import { createGoogleOAuthNodeServerRuntime } from '../lib/google-oauth-node-server-runtime.mjs';

const authToken = 'a'.repeat(48);
const ownerKey = Buffer.alloc(32, 17).toString('base64');
const tokenKey = Buffer.alloc(32, 19).toString('base64');
const env = {
  HAFIZE_CONNECTOR_AUTH_TOKEN: authToken,
  HAFIZE_CONNECTOR_AUTH_SUBJECT: 'user@example.test',
  HAFIZE_CONNECTOR_OWNER_KEY_B64: ownerKey,
  HAFIZE_GOOGLE_OAUTH_CLIENT_ID: 'google-client-123',
  HAFIZE_GOOGLE_OAUTH_CLIENT_SECRET: 'google-secret-456',
  HAFIZE_GOOGLE_OAUTH_REDIRECT_URI: 'https://hafize.example.test/api/connectors/gmail/oauth/callback',
  HAFIZE_OAUTH_FLOW_REDIS_URL: 'rediss://flow.example.test:6380/0',
  HAFIZE_OAUTH_TOKEN_REDIS_URL: 'rediss://token.example.test:6380/0',
  HAFIZE_OAUTH_TOKEN_KEY_B64: tokenKey
};
const sharedFlows = new Map();
let flowCloseCalls = 0;
let tokenCloseCalls = 0;
let exchangeCalls = 0;
let exchangedOwner = null;
let guardedTokenStore = null;
let tokenSaves = 0;
function createFlowStoreRuntime() {
  return {
    async issue(flow) {
      if (sharedFlows.has(flow.state)) throw new Error('OAUTH_FLOW_STATE_COLLISION');
      sharedFlows.set(flow.state, structuredClone(flow));
      return { state: flow.state };
    },
    async consume(state) {
      const flow = sharedFlows.get(state);
      if (!flow) {
        const error = new Error('OAUTH_FLOW_NOT_FOUND');
        error.code = 'OAUTH_FLOW_NOT_FOUND';
        throw error;
      }
      sharedFlows.delete(state);
      return flow;
    },
    async close() { flowCloseCalls += 1; }
  };
}
function createTokenStoreRuntime() {
  return {
    status() { return { configured: true, storage: 'encrypted-redis' }; },
    async save() { tokenSaves += 1; }, async load() { return null; }, async remove() {},
    async close() { tokenCloseCalls += 1; }
  };
}
function createTokenExchange({ tokenStore }) {
  guardedTokenStore = tokenStore;
  return {
    async exchange(input) {
      exchangeCalls += 1;
      exchangedOwner = input.ownerId;
      assert.equal(input.code, 'authorization-code-123');
      assert.match(input.verifier, /^[A-Za-z0-9._~-]{43,128}$/);
      assert.equal(input.redirectUri, env.HAFIZE_GOOGLE_OAUTH_REDIRECT_URI);
      return { scopes: ['https://www.googleapis.com/auth/gmail.readonly'], expiresAt: 9_999_999 };
    }
  };
}
const factories = { env, fetchImpl: async () => {}, createFlowStoreRuntime, createTokenStoreRuntime, createTokenExchange };
const first = createGoogleOAuthNodeServerRuntime(factories);
const second = createGoogleOAuthNodeServerRuntime(factories);
assert.equal(first.configured, true);
assert.ok(guardedTokenStore);
await guardedTokenStore.save({ tokenRecord: { scopes: ['https://www.googleapis.com/auth/gmail.readonly'] } });
assert.equal(tokenSaves, 1);
await assert.rejects(() => guardedTokenStore.save({ tokenRecord: { scopes: ['https://www.googleapis.com/auth/gmail.modify'] } }), /GOOGLE_OAUTH_SCOPE_ESCALATION/);
await assert.rejects(() => guardedTokenStore.save({ tokenRecord: { scopes: [] } }), /GOOGLE_OAUTH_SCOPE_ESCALATION/);
assert.equal(tokenSaves, 1);

let response = await first.handle({ method: 'POST', pathname: '/api/connectors/gmail/oauth/start', headers: {} });
assert.deepEqual(response, { matched: true, status: 401, body: { error: 'AUTH_REQUIRED' } });
response = await first.handle({ method: 'GET', pathname: '/api/connectors/gmail/oauth/start', headers: { authorization: `Bearer ${authToken}` } });
assert.equal(response.status, 405);
response = await first.handle({
  method: 'POST', pathname: '/api/connectors/gmail/oauth/start',
  headers: { authorization: `Bearer ${authToken}` }
});
assert.equal(response.status, 200);
assert.deepEqual(Object.keys(response.body), ['authorizationUrl']);
const authorization = new URL(response.body.authorizationUrl);
assert.equal(authorization.origin, 'https://accounts.google.com');
assert.equal(authorization.searchParams.get('scope'), 'https://www.googleapis.com/auth/gmail.readonly');
assert.equal(authorization.searchParams.get('access_type'), 'offline');
assert.equal(authorization.searchParams.get('include_granted_scopes'), 'false');
assert.equal(authorization.searchParams.get('prompt'), 'consent');
assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
assert.equal(authorization.searchParams.has('ownerId'), false);
assert.equal(authorization.searchParams.has('subject'), false);
const state = authorization.searchParams.get('state');
assert.match(state, /^[A-Za-z0-9_-]{32,128}$/);
const issued = sharedFlows.get(state);
assert.ok(issued?.ownerId);
assert.equal(response.body.authorizationUrl.includes(issued.ownerId), false);

const injected = new URL(env.HAFIZE_GOOGLE_OAUTH_REDIRECT_URI);
injected.searchParams.set('state', state);
injected.searchParams.set('code', 'authorization-code-123');
injected.searchParams.set('ownerId', 'owner_attacker');
response = await second.handle({ method: 'GET', pathname: injected.pathname, url: injected });
assert.equal(response.status, 400);
assert.equal(sharedFlows.has(state), true);
assert.equal(exchangeCalls, 0);

const callback = new URL(env.HAFIZE_GOOGLE_OAUTH_REDIRECT_URI);
callback.searchParams.set('state', state);
callback.searchParams.set('code', 'authorization-code-123');
callback.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.readonly');
callback.searchParams.set('authuser', '0');
callback.searchParams.set('prompt', 'consent');
response = await second.handle({ method: 'GET', pathname: callback.pathname, url: callback });
assert.equal(response.status, 200);
assert.deepEqual(response.body, {
  linked: true, provider: 'google',
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'], expiresAt: 9_999_999
});
assert.equal(exchangeCalls, 1);
assert.equal(exchangedOwner, issued.ownerId);
assert.equal(JSON.stringify(response).includes(issued.ownerId), false);
assert.equal(sharedFlows.has(state), false);
response = await first.handle({ method: 'GET', pathname: callback.pathname, url: callback });
assert.deepEqual(response, { matched: true, status: 400, body: { error: 'INVALID_OAUTH_CALLBACK' } });
assert.equal(exchangeCalls, 1);

response = await first.handle({
  method: 'POST', pathname: '/api/connectors/gmail/oauth/start',
  headers: { authorization: `Bearer ${authToken}` }
});
const deniedUrl = new URL(env.HAFIZE_GOOGLE_OAUTH_REDIRECT_URI);
deniedUrl.searchParams.set('state', new URL(response.body.authorizationUrl).searchParams.get('state'));
deniedUrl.searchParams.set('error', 'access_denied');
response = await second.handle({ method: 'GET', pathname: deniedUrl.pathname, url: deniedUrl });
assert.deepEqual(response, { matched: true, status: 400, body: { error: 'OAUTH_DENIED' } });
assert.equal(exchangeCalls, 1);

assert.deepEqual(await first.handle({ method: 'GET', pathname: '/api/unrelated' }), { matched: false });
assert.equal((await first.handle({ method: 'POST', pathname: '/api/connectors/gmail/oauth/callback' })).status, 405);
const closeA = first.close();
const closeB = first.close();
assert.strictEqual(closeA, closeB);
await closeA;
assert.equal(flowCloseCalls, 1);
assert.equal(tokenCloseCalls, 1);
await second.close();

const disabled = createGoogleOAuthNodeServerRuntime({ env: {} });
assert.equal(disabled.configured, false);
assert.equal((await disabled.handle({ pathname: '/api/connectors/gmail/oauth/start' })).status, 404);
assert.throws(() => createGoogleOAuthNodeServerRuntime({ env: { HAFIZE_GOOGLE_OAUTH_CLIENT_ID: 'partial' } }), /INVALID_GOOGLE_OAUTH_SERVER_RUNTIME:config/);
assert.throws(() => createGoogleOAuthNodeServerRuntime({
  ...factories,
  createTokenStoreRuntime: () => ({ status: () => ({ storage: 'encrypted-file' }), close: async () => {} })
}), /INVALID_GOOGLE_OAUTH_SERVER_RUNTIME:tokenStorage/);

console.log('Google OAuth production HTTP runtime tests passed');
