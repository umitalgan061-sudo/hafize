import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { createCloudSessionNodeServerRuntime } from '../lib/cloud-session-node-server-runtime.mjs';

const password = 'shared authenticator password';
const salt = Buffer.alloc(16, 41);
const digest = scryptSync(password, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}`,
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: Buffer.alloc(32, 43).toString('base64url'),
  HAFIZE_CLOUD_SESSION_SUBJECT: 'user:shared-boundary',
  HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example',
  HAFIZE_CLOUD_SESSION_TTL_MS: '120000'
};
let now = 2_000_000_000_000;

function loginRequest() {
  const bytes = Buffer.from(JSON.stringify({ password }));
  const request = (async function* () { yield bytes; })();
  request.socket = { remoteAddress: '127.0.0.1' };
  request.resume = () => {};
  return {
    request,
    headers: {
      origin: env.HAFIZE_CLOUD_SESSION_ORIGIN,
      'content-type': 'application/json',
      'content-length': String(bytes.length)
    }
  };
}

function emptyPostRequest() {
  const request = (async function* () {})();
  request.socket = { remoteAddress: '127.0.0.1' };
  request.resume = () => {};
  return {
    request,
    headers: { origin: env.HAFIZE_CLOUD_SESSION_ORIGIN }
  };
}

function cookie(response) {
  return response.headers['set-cookie'].split(';', 1)[0];
}

const runtime = createCloudSessionNodeServerRuntime({ env, now: () => now });
const input = loginRequest();
const login = await runtime.handle({ request: input.request, method: 'POST', pathname: '/api/session/login', headers: input.headers });
assert.equal(login.status, 200);
const sessionCookie = cookie(login);

const principalBefore = runtime.authenticator.authenticate({ headers: { cookie: sessionCookie } });
assert.equal(principalBefore.ok, true);
assert.equal(principalBefore.principal.subject, 'user:shared-boundary');
assert.equal(principalBefore.expiresAt, now + 120_000);

const logoutInput = emptyPostRequest();
const logout = await runtime.handle({
  request: logoutInput.request,
  method: 'POST',
  pathname: '/api/session/logout',
  headers: { ...logoutInput.headers, cookie: sessionCookie }
});
assert.equal(logout.status, 200);

assert.deepEqual(
  runtime.authenticator.authenticate({ headers: { cookie: sessionCookie } }),
  { ok: false, error: 'AUTH_REQUIRED' }
);
assert.deepEqual(
  runtime.authenticator.revoke({ headers: { cookie: sessionCookie } }),
  { ok: false, error: 'AUTH_REQUIRED' }
);
assert.deepEqual(
  runtime.authenticator.authenticate({ headers: { Cookie: sessionCookie } }),
  { ok: false, error: 'AUTH_REQUIRED' }
);
assert.deepEqual(
  runtime.authenticator.authenticate({ headers: { cookie: `${sessionCookie}; ${sessionCookie}` } }),
  { ok: false, error: 'AUTH_REQUIRED' }
);

// A second session for the same subject gets an independent nonce and remains usable.
const secondInput = loginRequest();
const secondLogin = await runtime.handle({ request: secondInput.request, method: 'POST', pathname: '/api/session/login', headers: secondInput.headers });
assert.equal(secondLogin.status, 200);
const secondCookie = cookie(secondLogin);
assert.notEqual(secondCookie, sessionCookie);
assert.equal(runtime.authenticator.authenticate({ headers: { cookie: secondCookie } }).ok, true);

// A separately-created runtime in the same process shares the bounded fingerprint deny-set.
// This models multiple auth consumers, not a process restart. A real restart still clears memory.
const siblingRuntime = createCloudSessionNodeServerRuntime({ env, now: () => now });
assert.deepEqual(
  siblingRuntime.authenticator.authenticate({ headers: { cookie: sessionCookie } }),
  { ok: false, error: 'AUTH_REQUIRED' }
);
assert.equal(siblingRuntime.authenticator.authenticate({ headers: { cookie: secondCookie } }).ok, true);

// Expiry remains authoritative for both runtimes.
now += 120_000;
assert.deepEqual(
  siblingRuntime.authenticator.authenticate({ headers: { cookie: sessionCookie } }),
  { ok: false, error: 'AUTH_REQUIRED' }
);
assert.deepEqual(
  runtime.authenticator.authenticate({ headers: { cookie: secondCookie } }),
  { ok: false, error: 'AUTH_REQUIRED' }
);

console.log('cloud session shared authenticator revocation tests passed');
