import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { createCloudSessionNodeServerRuntime } from '../lib/cloud-session-node-server-runtime.mjs';

const password = 'correct horse battery staple';
const salt = Buffer.alloc(16, 23);
const digest = scryptSync(password, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const passwordHash = `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}`;
const signingKey = Buffer.alloc(32, 31).toString('base64url');
const origin = 'https://hafize.example';
let now = 1_900_000_000_000;

const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: passwordHash,
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: signingKey,
  HAFIZE_CLOUD_SESSION_SUBJECT: 'user:integration',
  HAFIZE_CLOUD_SESSION_ORIGIN: origin,
  HAFIZE_CLOUD_SESSION_TTL_MS: '60000'
};

function requestJson(body, remoteAddress = '127.0.0.1') {
  const bytes = Buffer.from(JSON.stringify(body));
  const iterable = (async function* () { yield bytes; })();
  iterable.socket = { remoteAddress };
  iterable.resume = () => {};
  return { request: iterable, headers: { origin, 'content-type': 'application/json', 'content-length': String(bytes.length) } };
}

function cookieFrom(response) {
  const setCookie = response.headers['set-cookie'];
  assert.equal(typeof setCookie, 'string');
  return setCookie.split(';', 1)[0];
}

const runtime = createCloudSessionNodeServerRuntime({ env, now: () => now });
assert.equal(runtime.configured, true);
assert.equal(typeof runtime.authenticator.revoke, 'function');

const loginInput = requestJson({ password });
const login = await runtime.handle({
  request: loginInput.request,
  method: 'POST',
  pathname: '/api/session/login',
  headers: loginInput.headers
});
assert.equal(login.status, 200);
assert.deepEqual(login.body, { authenticated: true, expiresAt: now + 60_000 });
const cookie = cookieFrom(login);

const statusBefore = await runtime.handle({
  method: 'GET',
  pathname: '/api/session/status',
  headers: { cookie }
});
assert.equal(statusBefore.status, 200);
assert.deepEqual(statusBefore.body, { authenticated: true, expiresAt: now + 60_000 });

const logoutInput = requestJson({});
const logout = await runtime.handle({
  request: logoutInput.request,
  method: 'POST',
  pathname: '/api/session/logout',
  headers: { ...logoutInput.headers, cookie }
});
assert.equal(logout.status, 200);
assert.deepEqual(logout.body, { authenticated: false });
assert.match(logout.headers['set-cookie'], /^__Host-hafize_session=; Path=\/; Max-Age=0;/);

// Replay of the exact cookie copied before logout must now fail server-side.
const replay = await runtime.handle({
  method: 'GET',
  pathname: '/api/session/status',
  headers: { cookie }
});
assert.equal(replay.status, 401);
assert.deepEqual(replay.body, { authenticated: false, error: 'AUTH_REQUIRED' });

const repeatedLogoutInput = requestJson({});
const repeatedLogout = await runtime.handle({
  request: repeatedLogoutInput.request,
  method: 'POST',
  pathname: '/api/session/logout',
  headers: { ...repeatedLogoutInput.headers, cookie }
});
assert.equal(repeatedLogout.status, 401);
assert.equal(repeatedLogout.headers['set-cookie'], undefined);

// A fresh login receives a different nonce/token and is not poisoned by prior revocation.
const secondLoginInput = requestJson({ password });
const secondLogin = await runtime.handle({
  request: secondLoginInput.request,
  method: 'POST',
  pathname: '/api/session/login',
  headers: secondLoginInput.headers
});
assert.equal(secondLogin.status, 200);
const secondCookie = cookieFrom(secondLogin);
assert.notEqual(secondCookie, cookie);
assert.equal((await runtime.handle({ method: 'GET', pathname: '/api/session/status', headers: { cookie: secondCookie } })).status, 200);

// Expiry still wins over revocation state and no session lifetime is extended.
now += 60_000;
assert.equal((await runtime.handle({ method: 'GET', pathname: '/api/session/status', headers: { cookie: secondCookie } })).status, 401);

// Origin remains mandatory for logout; a foreign origin cannot revoke a user's session.
const thirdLoginInput = requestJson({ password });
const thirdLogin = await runtime.handle({ request: thirdLoginInput.request, method: 'POST', pathname: '/api/session/login', headers: thirdLoginInput.headers });
assert.equal(thirdLogin.status, 200);
const thirdCookie = cookieFrom(thirdLogin);
const foreignLogoutInput = requestJson({});
const foreignLogout = await runtime.handle({
  request: foreignLogoutInput.request,
  method: 'POST',
  pathname: '/api/session/logout',
  headers: { ...foreignLogoutInput.headers, origin: 'https://evil.example', cookie: thirdCookie }
});
assert.equal(foreignLogout.status, 403);
assert.equal((await runtime.handle({ method: 'GET', pathname: '/api/session/status', headers: { cookie: thirdCookie } })).status, 200);

console.log('cloud session node logout revocation integration tests passed');
