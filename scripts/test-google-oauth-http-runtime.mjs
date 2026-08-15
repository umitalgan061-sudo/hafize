import assert from 'node:assert/strict';
import { createGoogleOAuthHttpRuntime, GOOGLE_OAUTH_HTTP_PATHS } from '../lib/google-oauth-http-runtime.mjs';
import { createOAuthFlowStore } from '../lib/oauth-flow-store.mjs';

const AUTH_TOKEN = 't'.repeat(48);
const OWNER_KEY = Buffer.alloc(32, 7).toString('base64');
const BASE_ENV = {
  HAFIZE_GOOGLE_OAUTH_REDIRECT_URI: 'https://hafize.example.test/api/connectors/gmail/oauth/callback',
  HAFIZE_GOOGLE_OAUTH_CLIENT_ID: 'client-id.apps.googleusercontent.com',
  HAFIZE_GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
  HAFIZE_CONNECTOR_AUTH_TOKEN: AUTH_TOKEN,
  HAFIZE_CONNECTOR_AUTH_SUBJECT: 'person@example.test',
  HAFIZE_CONNECTOR_OWNER_KEY_B64: OWNER_KEY,
  HAFIZE_OAUTH_REDIS_URL: 'rediss://redis.example.test:6380'
};

function request(body) { return { body }; }
function url(path, query = '') { return new URL(`https://hafize.example.test${path}${query}`); }
function authHeaders(token = AUTH_TOKEN) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=utf-8' };
}

const store = createOAuthFlowStore({ now: () => 10_000 });
let closes = 0;
const exchanges = [];
const runtime = await createGoogleOAuthHttpRuntime({
  env: BASE_ENV,
  readJson: async (req) => req.body,
  createTokenStoreRuntime: () => ({ async save() {} }),
  createFlowStoreRuntime: async () => ({ configured: true, store, async close() { closes += 1; } }),
  createTokenExchange: () => ({
    async exchange(input) { exchanges.push(input); return { provider: 'google', ownerId: input.ownerId, refreshTokenStored: true }; }
  })
});
assert.equal(runtime.configured, true);
assert.deepEqual(runtime.status(), { configured: true, provider: 'google', callbackPath: GOOGLE_OAUTH_HTTP_PATHS.callback });

const unauth = await runtime.handle({
  request: request({ capabilities: ['gmail.read'] }), method: 'POST', pathname: GOOGLE_OAUTH_HTTP_PATHS.start,
  url: url(GOOGLE_OAUTH_HTTP_PATHS.start), headers: authHeaders('x'.repeat(48))
});
assert.deepEqual(unauth.body, { error: 'AUTH_REQUIRED' });
assert.equal(unauth.status, 401);
assert.equal(store.size(), 0, 'unauthenticated start must not issue state');

const unsupportedMedia = await runtime.handle({
  request: request({ capabilities: ['gmail.read'] }), method: 'POST', pathname: GOOGLE_OAUTH_HTTP_PATHS.start,
  url: url(GOOGLE_OAUTH_HTTP_PATHS.start), headers: { authorization: `Bearer ${AUTH_TOKEN}`, 'content-type': 'text/plain' }
});
assert.equal(unsupportedMedia.status, 415);
assert.deepEqual(unsupportedMedia.body, { error: 'UNSUPPORTED_MEDIA_TYPE' });
assert.equal(store.size(), 0);

const writeScope = await runtime.handle({
  request: request({ capabilities: ['gmail.send'], explicitUserIntent: true }), method: 'POST', pathname: GOOGLE_OAUTH_HTTP_PATHS.start,
  url: url(GOOGLE_OAUTH_HTTP_PATHS.start), headers: authHeaders()
});
assert.equal(writeScope.status, 403);
assert.deepEqual(writeScope.body, { error: 'OAUTH_SCOPE_NOT_ALLOWED' });
assert.equal(store.size(), 0, 'production HTTP boundary must not issue write grants');

const started = await runtime.handle({
  request: request({ capabilities: ['identity', 'gmail.read'] }), method: 'POST', pathname: GOOGLE_OAUTH_HTTP_PATHS.start,
  url: url(GOOGLE_OAUTH_HTTP_PATHS.start), headers: authHeaders()
});
assert.equal(started.status, 200);
assert.equal(typeof started.body.authorizationUrl, 'string');
assert.equal(started.body.expiresAt, 610_000);
assert.deepEqual(started.body.capabilities, ['identity', 'gmail.read']);
assert.equal(started.body.requiresWriteApproval, false);
assert.equal('state' in started.body, false, 'state must only travel inside provider authorization URL');
assert.equal(JSON.stringify(started.body).includes('person@example.test'), false);
assert.equal(JSON.stringify(started.body).includes('client-secret'), false);

const authorization = new URL(started.body.authorizationUrl);
const state = authorization.searchParams.get('state');
assert.match(state, /^[A-Za-z0-9_-]{32,128}$/);
assert.equal(authorization.searchParams.get('redirect_uri'), BASE_ENV.HAFIZE_GOOGLE_OAUTH_REDIRECT_URI);
assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
assert.equal(authorization.searchParams.get('access_type'), 'offline');
assert.equal(authorization.searchParams.get('include_granted_scopes'), 'true');
assert.equal(authorization.searchParams.get('prompt'), 'consent');
assert.equal(authorization.searchParams.get('scope').includes('gmail.readonly'), true);

const duplicate = await runtime.handle({
  method: 'GET', pathname: GOOGLE_OAUTH_HTTP_PATHS.callback,
  url: url(GOOGLE_OAUTH_HTTP_PATHS.callback, `?state=${state}&state=${state}&code=authorization-code-1`), headers: {}
});
assert.equal(duplicate.status, 400);
assert.equal(store.size(), 1, 'malformed duplicate query must not burn a valid flow');

const linked = await runtime.handle({
  method: 'GET', pathname: GOOGLE_OAUTH_HTTP_PATHS.callback,
  url: url(GOOGLE_OAUTH_HTTP_PATHS.callback, `?state=${state}&code=authorization-code-1`), headers: {}
});
assert.deepEqual(linked.body, { linked: true });
assert.equal(linked.status, 200);
assert.equal(exchanges.length, 1);
assert.match(exchanges[0].ownerId, /^owner_[A-Za-z0-9_-]{43}$/);
assert.equal(exchanges[0].code, 'authorization-code-1');
assert.equal(exchanges[0].redirectUri, BASE_ENV.HAFIZE_GOOGLE_OAUTH_REDIRECT_URI);
assert.deepEqual(exchanges[0].expectedScopes, ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/gmail.readonly']);
assert.equal(exchanges[0].requireRefreshToken, true, 'HTTP linking must require a durable offline grant');
assert.equal(typeof exchanges[0].verifier, 'string');
assert.equal(exchanges[0].verifier.length >= 43, true);

const replay = await runtime.handle({
  method: 'GET', pathname: GOOGLE_OAUTH_HTTP_PATHS.callback,
  url: url(GOOGLE_OAUTH_HTTP_PATHS.callback, `?state=${state}&code=authorization-code-1`), headers: {}
});
assert.equal(replay.status, 400);
assert.deepEqual(replay.body, { error: 'INVALID_OAUTH_REQUEST' });
assert.equal(exchanges.length, 1, 'replayed callback must not exchange twice');

const deniedStart = await runtime.handle({
  request: request({ capabilities: ['gmail.read'] }), method: 'POST', pathname: GOOGLE_OAUTH_HTTP_PATHS.start,
  url: url(GOOGLE_OAUTH_HTTP_PATHS.start), headers: authHeaders()
});
const deniedState = new URL(deniedStart.body.authorizationUrl).searchParams.get('state');
const denied = await runtime.handle({
  method: 'GET', pathname: GOOGLE_OAUTH_HTTP_PATHS.callback,
  url: url(GOOGLE_OAUTH_HTTP_PATHS.callback, `?state=${deniedState}&error=access_denied&error_description=nope`), headers: {}
});
assert.equal(denied.status, 400);
assert.deepEqual(denied.body, { linked: false, error: 'OAUTH_PROVIDER_DENIED' });
assert.equal(JSON.stringify(denied.body).includes('nope'), false, 'provider descriptions must not be reflected');
assert.equal(exchanges.length, 1);

const queryOnStart = await runtime.handle({
  request: request({ capabilities: ['gmail.read'] }), method: 'POST', pathname: GOOGLE_OAUTH_HTTP_PATHS.start,
  url: url(GOOGLE_OAUTH_HTTP_PATHS.start, '?next=https://evil.example'), headers: authHeaders()
});
assert.equal(queryOnStart.status, 400);
const wrongStartMethod = await runtime.handle({ method: 'GET', pathname: GOOGLE_OAUTH_HTTP_PATHS.start, url: url(GOOGLE_OAUTH_HTTP_PATHS.start) });
assert.equal(wrongStartMethod.status, 405);
assert.deepEqual(wrongStartMethod.headers, { Allow: 'POST' });
const wrongCallbackMethod = await runtime.handle({ method: 'POST', pathname: GOOGLE_OAUTH_HTTP_PATHS.callback, url: url(GOOGLE_OAUTH_HTTP_PATHS.callback) });
assert.equal(wrongCallbackMethod.status, 405);
assert.deepEqual(wrongCallbackMethod.headers, { Allow: 'GET' });
assert.deepEqual(await runtime.handle({ method: 'GET', pathname: '/unrelated' }), { matched: false });

const closeA = runtime.close();
const closeB = runtime.close();
assert.strictEqual(closeA, closeB);
await closeA;
assert.equal(closes, 1);

const disabled = await createGoogleOAuthHttpRuntime({ env: {}, readJson: async () => ({}) });
assert.equal(disabled.configured, false);
assert.equal((await disabled.handle({ pathname: GOOGLE_OAUTH_HTTP_PATHS.start })).status, 404);
assert.deepEqual(await disabled.handle({ pathname: '/elsewhere' }), { matched: false });

await assert.rejects(() => createGoogleOAuthHttpRuntime({
  env: { ...BASE_ENV, HAFIZE_GOOGLE_OAUTH_CLIENT_ID: '' }, readJson: async () => ({})
}), /INVALID_GOOGLE_OAUTH_HTTP_RUNTIME:HAFIZE_GOOGLE_OAUTH_CLIENT_ID/);
await assert.rejects(() => createGoogleOAuthHttpRuntime({
  env: { ...BASE_ENV, HAFIZE_GOOGLE_OAUTH_REDIRECT_URI: 'https://hafize.example.test/wrong' }, readJson: async () => ({})
}), /INVALID_GOOGLE_OAUTH_HTTP_RUNTIME:HAFIZE_GOOGLE_OAUTH_REDIRECT_URI/);
await assert.rejects(() => createGoogleOAuthHttpRuntime({
  env: BASE_ENV, readJson: async () => ({}), startBodyTimeoutMs: 0
}), /INVALID_GOOGLE_OAUTH_HTTP_RUNTIME:startBodyTimeoutMs/);

console.log('Google OAuth HTTP runtime tests passed');
