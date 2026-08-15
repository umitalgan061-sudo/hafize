import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { createCloudSessionAuth } from '../lib/cloud-session-auth.mjs';
import { createConnectorOwnerResolver } from '../lib/connector-owner-principal.mjs';
import { createGoogleOAuthHttpRuntime, GOOGLE_OAUTH_HTTP_PATHS } from '../lib/google-oauth-http-runtime.mjs';
import { createOAuthFlowStore } from '../lib/oauth-flow-store.mjs';

const PASSWORD = 'correct horse battery staple';
const SUBJECT = 'person@example.test';
const ORIGIN = 'https://hafize.example.test';
const TTL_MS = 4 * 60 * 60 * 1000;
const salt = Buffer.alloc(16, 0x31);
const digest = scryptSync(PASSWORD, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const passwordHash = `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}`;
const signingKey = Buffer.alloc(32, 0x52).toString('base64url');
const ownerKeyBytes = Buffer.alloc(32, 0x73);
const ownerKey = ownerKeyBytes.toString('base64');
const legacyBearer = 'legacy-connector-token-that-browser-must-not-need-0001';

const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: passwordHash,
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: signingKey,
  HAFIZE_CLOUD_SESSION_SUBJECT: SUBJECT,
  HAFIZE_CLOUD_SESSION_ORIGIN: ORIGIN,
  HAFIZE_CLOUD_SESSION_TTL_MS: String(TTL_MS),
  HAFIZE_GOOGLE_OAUTH_REDIRECT_URI: `${ORIGIN}${GOOGLE_OAUTH_HTTP_PATHS.callback}`,
  HAFIZE_GOOGLE_OAUTH_CLIENT_ID: 'client-id.apps.googleusercontent.com',
  HAFIZE_GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
  HAFIZE_CONNECTOR_OWNER_KEY_B64: ownerKey,
  HAFIZE_OAUTH_REDIS_URL: 'rediss://redis.example.test:6380',
  HAFIZE_CONNECTOR_AUTH_TOKEN: legacyBearer,
  HAFIZE_CONNECTOR_AUTH_SUBJECT: 'legacy@example.test'
};

const sessionAuth = createCloudSessionAuth({
  passwordHash,
  signingKey,
  subject: SUBJECT,
  ttlMs: TTL_MS
});
const login = await sessionAuth.login({ password: PASSWORD });
assert.equal(login.ok, true);
const cookie = login.setCookie.split(';', 1)[0];
assert.match(cookie, /^__Host-hafize_session=/);
assert.equal(cookie.includes(PASSWORD), false);
assert.equal(cookie.includes(SUBJECT), false, 'subject must remain encoded/signed rather than exposed as cookie metadata');

const store = createOAuthFlowStore();
const exchanges = [];
let closed = 0;
const runtime = await createGoogleOAuthHttpRuntime({
  env,
  readJson: async (request) => request.body,
  createTokenStoreRuntime: () => ({ async save() {} }),
  createFlowStoreRuntime: async () => ({ configured: true, store, async close() { closed += 1; } }),
  createTokenExchange: () => ({
    async exchange(input) {
      exchanges.push(input);
      return { provider: 'google', ownerId: input.ownerId, refreshTokenStored: true };
    }
  })
});

function startHeaders({ cookieValue = cookie, origin = ORIGIN, authorization } = {}) {
  return {
    cookie: cookieValue,
    origin,
    'content-type': 'application/json',
    ...(authorization ? { authorization } : {})
  };
}

async function start(headers, body = { capabilities: ['gmail.read'] }) {
  return runtime.handle({
    request: { body },
    method: 'POST',
    pathname: GOOGLE_OAUTH_HTTP_PATHS.start,
    url: new URL(`${ORIGIN}${GOOGLE_OAUTH_HTTP_PATHS.start}`),
    headers
  });
}

const noCookie = await start({ origin: ORIGIN, 'content-type': 'application/json', authorization: `Bearer ${legacyBearer}` });
assert.equal(noCookie.status, 401);
assert.deepEqual(noCookie.body, { error: 'AUTH_REQUIRED' });
assert.equal(store.size(), 0, 'legacy connector bearer must never issue OAuth state');

const token = cookie.slice(cookie.indexOf('=') + 1);
const tamperedToken = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
const tampered = await start(startHeaders({ cookieValue: `__Host-hafize_session=${tamperedToken}` }));
assert.equal(tampered.status, 401);
assert.equal(store.size(), 0, 'tampered session must not issue OAuth state');

const duplicate = await start(startHeaders({ cookieValue: `${cookie}; ${cookie}` }));
assert.equal(duplicate.status, 401);
assert.equal(store.size(), 0, 'duplicate session cookies fail closed');

const wrongOrigin = await start(startHeaders({ origin: 'https://evil.example' }));
assert.equal(wrongOrigin.status, 403);
assert.deepEqual(wrongOrigin.body, { error: 'ORIGIN_REQUIRED' });
assert.equal(store.size(), 0, 'cross-origin request must fail before state issuance');

const started = await start(startHeaders());
assert.equal(started.status, 200);
assert.deepEqual(started.body.capabilities, ['gmail.read']);
assert.equal(started.body.requiresWriteApproval, false);
const authorizationUrl = new URL(started.body.authorizationUrl);
const state = authorizationUrl.searchParams.get('state');
assert.match(state, /^[A-Za-z0-9_-]{32,128}$/);
assert.equal(store.size(), 1);

const callback = await runtime.handle({
  method: 'GET',
  pathname: GOOGLE_OAUTH_HTTP_PATHS.callback,
  url: new URL(`${ORIGIN}${GOOGLE_OAUTH_HTTP_PATHS.callback}?state=${state}&code=cloud-session-code`),
  headers: {}
});
assert.equal(callback.status, 200, 'provider callback must not require browser session cookie');
assert.deepEqual(callback.body, { linked: true });
assert.equal(exchanges.length, 1);

const expectedOwner = createConnectorOwnerResolver({ key: ownerKeyBytes }).resolve({ authenticated: true, subject: SUBJECT }).ownerId;
assert.equal(exchanges[0].ownerId, expectedOwner, 'OAuth grant owner must derive from authenticated session subject');
assert.equal(exchanges[0].code, 'cloud-session-code');
assert.equal(exchanges[0].requireRefreshToken, true);
assert.equal(store.size(), 0, 'callback must consume one-time flow state');

const replay = await runtime.handle({
  method: 'GET',
  pathname: GOOGLE_OAUTH_HTTP_PATHS.callback,
  url: new URL(`${ORIGIN}${GOOGLE_OAUTH_HTTP_PATHS.callback}?state=${state}&code=cloud-session-code`),
  headers: startHeaders()
});
assert.equal(replay.status, 400, 'session cookie must not make consumed state reusable');
assert.deepEqual(replay.body, { error: 'INVALID_OAUTH_REQUEST' });
assert.equal(exchanges.length, 1);

const foreignAuth = createCloudSessionAuth({
  passwordHash,
  signingKey,
  subject: 'other@example.test',
  ttlMs: TTL_MS
});
const foreignLogin = await foreignAuth.login({ password: PASSWORD });
const foreignCookie = foreignLogin.setCookie.split(';', 1)[0];
const foreign = await start(startHeaders({ cookieValue: foreignCookie }));
assert.equal(foreign.status, 401, 'a token signed for another configured subject must fail closed');
assert.equal(store.size(), 0);

await runtime.close();
assert.equal(closed, 1);
console.log('Google OAuth cloud-session integration tests passed');
