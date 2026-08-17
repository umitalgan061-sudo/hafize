import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { createCloudSessionNodeServerRuntime } from '../lib/cloud-session-node-server-runtime.mjs';

const password = 'http-rotation-password';
const salt = Buffer.alloc(16, 61);
const digest = scryptSync(password, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const passwordHash = `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}`;
const oldKey = Buffer.alloc(32, 62).toString('base64url');
const newKey = Buffer.alloc(32, 63).toString('base64url');
const subject = 'http-rotation-user';
const origin = 'https://hafize.example';
let clock = 1_800_000_400_000;

function env(signingKey, previousSigningKey = '') {
  return {
    HAFIZE_CLOUD_SESSION_PASSWORD_HASH: passwordHash,
    HAFIZE_CLOUD_SESSION_SIGNING_KEY: signingKey,
    ...(previousSigningKey ? { HAFIZE_CLOUD_SESSION_PREVIOUS_SIGNING_KEY: previousSigningKey } : {}),
    HAFIZE_CLOUD_SESSION_SUBJECT: subject,
    HAFIZE_CLOUD_SESSION_ORIGIN: origin,
    HAFIZE_CLOUD_SESSION_TTL_MS: '60000'
  };
}

function request(body = '') {
  const data = Buffer.from(body, 'utf8');
  return {
    socket: { remoteAddress: '127.0.0.1' },
    async *[Symbol.asyncIterator]() {
      if (data.length) yield data;
    },
    resume() {}
  };
}

function loginHeaders() {
  const body = JSON.stringify({ password });
  return {
    origin,
    'content-type': 'application/json',
    'content-length': String(Buffer.byteLength(body))
  };
}

function cookieFrom(response) {
  const setCookie = response.headers?.['set-cookie'];
  assert.equal(typeof setCookie, 'string');
  return setCookie.split(';', 1)[0];
}

async function login(runtime) {
  const body = JSON.stringify({ password });
  const response = await runtime.handle({
    request: request(body),
    method: 'POST',
    pathname: '/api/session/login',
    headers: loginHeaders()
  });
  assert.equal(response.matched, true);
  assert.equal(response.status, 200);
  return cookieFrom(response);
}

async function status(runtime, cookie) {
  return runtime.handle({
    request: request(),
    method: 'GET',
    pathname: '/api/session/status',
    headers: { cookie }
  });
}

async function logout(runtime, cookie) {
  return runtime.handle({
    request: request(),
    method: 'POST',
    pathname: '/api/session/logout',
    headers: { cookie, origin }
  });
}

const oldRuntime = createCloudSessionNodeServerRuntime({ env: env(oldKey), now: () => clock });
const oldCookie = await login(oldRuntime);
assert.equal((await status(oldRuntime, oldCookie)).status, 200);

const rotatedRuntime = createCloudSessionNodeServerRuntime({ env: env(newKey, oldKey), now: () => clock });
const oldStatusDuringOverlap = await status(rotatedRuntime, oldCookie);
assert.equal(oldStatusDuringOverlap.status, 200);
assert.equal(oldStatusDuringOverlap.body.authenticated, true);
assert.equal(oldStatusDuringOverlap.body.subject, subject);
assert.equal(Object.prototype.hasOwnProperty.call(oldStatusDuringOverlap.body, 'signingKeySlot'), false);

const newCookie = await login(rotatedRuntime);
assert.notEqual(newCookie, oldCookie);
assert.equal((await status(rotatedRuntime, newCookie)).status, 200);
assert.equal((await status(oldRuntime, newCookie)).status, 401, 'new cookie must be signed only by new active key');

const logoutResponse = await logout(rotatedRuntime, oldCookie);
assert.equal(logoutResponse.status, 200);
assert.match(logoutResponse.headers?.['set-cookie'] || '', /Max-Age=0/);
assert.equal((await status(rotatedRuntime, oldCookie)).status, 401, 'logout revocation survives overlap');
assert.equal((await status(oldRuntime, oldCookie)).status, 401, 'shared process revocation is visible to old-key consumer');

const afterOverlap = createCloudSessionNodeServerRuntime({ env: env(newKey), now: () => clock });
assert.equal((await status(afterOverlap, oldCookie)).status, 401);
assert.equal((await status(afterOverlap, newCookie)).status, 200);

const wrongOriginLogout = await rotatedRuntime.handle({
  request: request(),
  method: 'POST',
  pathname: '/api/session/logout',
  headers: { cookie: newCookie, origin: 'https://evil.example' }
});
assert.equal(wrongOriginLogout.status, 403);
assert.equal((await status(rotatedRuntime, newCookie)).status, 200, 'foreign Origin cannot revoke valid session');

clock += 60_001;
assert.equal((await status(rotatedRuntime, newCookie)).status, 401);

console.log('cloud session rotation HTTP integration tests passed');
