import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { createCloudSessionNodeServerRuntime } from '../lib/cloud-session-node-server-runtime.mjs';

const PASSWORD = 'http-integration-password';
const SALT = Buffer.from('1234567890abcdef1234567890abcdef', 'hex');
const KEY = Buffer.alloc(32, 19).toString('base64url');
const N = 16_384;
const r = 8;
const p = 1;
const digest = scryptSync(PASSWORD, SALT, 32, { N, r, p, maxmem: 32 * 1024 * 1024 });
const passwordHash = `scrypt$${N}$${r}$${p}$${SALT.toString('base64url')}$${digest.toString('base64url')}`;
const origin = 'https://hafize.example';
const now = 1_800_000_000_000;

function env(hash = passwordHash) {
  return {
    HAFIZE_CLOUD_SESSION_PASSWORD_HASH: hash,
    HAFIZE_CLOUD_SESSION_SIGNING_KEY: KEY,
    HAFIZE_CLOUD_SESSION_SUBJECT: 'http-user',
    HAFIZE_CLOUD_SESSION_ORIGIN: origin,
    HAFIZE_CLOUD_SESSION_TTL_MS: '60000'
  };
}

function request(body, remoteAddress = '127.0.0.1') {
  const bytes = Buffer.from(body);
  return {
    socket: { remoteAddress },
    async *[Symbol.asyncIterator]() { yield bytes; },
    resume() {}
  };
}

function loginArgs(password, headers = {}) {
  const body = JSON.stringify({ password });
  return {
    request: request(body),
    method: 'POST',
    pathname: '/api/session/login',
    headers: {
      origin,
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(body)),
      ...headers
    }
  };
}

const runtime = createCloudSessionNodeServerRuntime({ env: env(), now: () => now });
const failed = await runtime.handle(loginArgs('wrong-http-password'));
assert.equal(failed.status, 401);
assert.deepEqual(failed.body, { authenticated: false, error: 'AUTH_REQUIRED' });
assert.equal(failed.headers['set-cookie'], undefined);

const loggedIn = await runtime.handle(loginArgs(PASSWORD));
assert.equal(loggedIn.status, 200);
assert.equal(loggedIn.body.authenticated, true);
assert.equal(loggedIn.body.expiresAt, now + 60_000);
assert.match(loggedIn.headers['set-cookie'], /^__Host-hafize_session=/);
const cookie = loggedIn.headers['set-cookie'].split(';', 1)[0];

const status = await runtime.handle({
  method: 'GET',
  pathname: '/api/session/status',
  headers: { cookie }
});
assert.equal(status.status, 200);
assert.equal(status.body.authenticated, true);
assert.equal(status.body.expiresAt, now + 60_000);

// Exact Origin enforcement remains independent from scrypt resource handling.
const crossOrigin = await runtime.handle(loginArgs(PASSWORD, { origin: 'https://evil.example' }));
assert.equal(crossOrigin.status, 403);
assert.deepEqual(crossOrigin.body, { error: 'ORIGIN_REQUIRED' });

// Unsafe resource configuration is rejected at runtime construction, not deferred to HTTP traffic.
const unsafeHash = `scrypt$1048576$8$1$${SALT.toString('base64url')}$${digest.toString('base64url')}`;
assert.throws(
  () => createCloudSessionNodeServerRuntime({ env: env(unsafeHash), now: () => now }),
  (error) => error?.code === 'INVALID_CLOUD_SESSION_AUTH:passwordHash.cost'
);

console.log('cloud session bounded scrypt HTTP integration: ok');
