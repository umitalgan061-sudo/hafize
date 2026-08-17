import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createCloudSessionNodeServerRuntime } from '../lib/cloud-session-node-server-runtime.mjs';

const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: 'test-hash',
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: '0123456789abcdef0123456789abcdef',
  HAFIZE_CLOUD_SESSION_SUBJECT: 'owner:test',
  HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example'
};

function request(body, remoteAddress = '127.0.0.1') {
  const stream = Readable.from([Buffer.from(JSON.stringify(body))]);
  stream.socket = { remoteAddress };
  return stream;
}

const fakeAuth = {
  async login({ password }) {
    return password === 'correct'
      ? { ok: true, expiresAt: 123456, setCookie: 'hafize_session=fake; HttpOnly; Secure; SameSite=Strict' }
      : { ok: false };
  },
  authenticate() { return { ok: false }; },
  logoutCookie() { return 'hafize_session=; Max-Age=0'; }
};

const runtime = createCloudSessionNodeServerRuntime({
  env,
  createAuth: () => fakeAuth,
  loginAttempts: 3,
  loginWindowMs: 60_000,
  now: () => 10_000
});

assert.equal(runtime.configured, true);

for (let index = 0; index < 12; index += 1) {
  const response = await runtime.handle({
    request: request({ password: 'correct' }),
    method: 'POST',
    pathname: '/api/session/login',
    headers: {
      origin: 'https://hafize.example',
      'content-type': 'application/json'
    }
  });
  assert.equal(response.status, 200, `successful login ${index + 1} must not consume the failure budget`);
  assert.equal(response.body.authenticated, true);
  assert.match(response.headers['set-cookie'], /HttpOnly/);
}

const wrong1 = await runtime.handle({
  request: request({ password: 'wrong' }),
  method: 'POST',
  pathname: '/api/session/login',
  headers: { origin: 'https://hafize.example', 'content-type': 'application/json' }
});
assert.equal(wrong1.status, 401);

const successAfterFailure = await runtime.handle({
  request: request({ password: 'correct' }),
  method: 'POST',
  pathname: '/api/session/login',
  headers: { origin: 'https://hafize.example', 'content-type': 'application/json' }
});
assert.equal(successAfterFailure.status, 200);

for (let index = 0; index < 3; index += 1) {
  const response = await runtime.handle({
    request: request({ password: 'wrong' }),
    method: 'POST',
    pathname: '/api/session/login',
    headers: { origin: 'https://hafize.example', 'content-type': 'application/json' }
  });
  assert.equal(response.status, 401);
}

const blocked = await runtime.handle({
  request: request({ password: 'correct' }),
  method: 'POST',
  pathname: '/api/session/login',
  headers: { origin: 'https://hafize.example', 'content-type': 'application/json' }
});
assert.equal(blocked.status, 429, 'a correct password must not bypass an already exhausted failure window');
assert.equal(blocked.body.error, 'RATE_LIMITED');
assert.equal(blocked.headers['retry-after'], '60');

console.log('cloud session login limiter success reset ok');
