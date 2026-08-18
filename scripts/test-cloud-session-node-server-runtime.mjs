import assert from 'node:assert/strict';
import { createCloudSessionNodeServerRuntime, CLOUD_SESSION_SERVER_ENV } from '../lib/cloud-session-node-server-runtime.mjs';

const baseEnv = {
  [CLOUD_SESSION_SERVER_ENV.passwordHash]: 'scrypt$16384$8$1$salt$digest',
  [CLOUD_SESSION_SERVER_ENV.signingKey]: 'signing-key-placeholder',
  [CLOUD_SESSION_SERVER_ENV.subject]: 'owner@example.test',
  [CLOUD_SESSION_SERVER_ENV.origin]: 'https://hafize.example.test'
};

function fakeAuthFactory() {
  return {
    async login({ password }) {
      return password === 'valid password value'
        ? { ok: true, expiresAt: 9999, setCookie: '__Host-hafize_session=signed; Path=/; HttpOnly; Secure; SameSite=Strict' }
        : { ok: false, error: 'AUTH_REQUIRED' };
    },
    authenticate({ headers }) {
      return headers?.cookie?.includes('signed')
        ? { ok: true, expiresAt: 9999, principal: { authenticated: true, subject: 'owner@example.test' } }
        : { ok: false, error: 'AUTH_REQUIRED' };
    },
    revoke({ headers }) {
      return headers?.cookie?.includes('signed')
        ? { ok: true, expiresAt: 9999, principal: { authenticated: true, subject: 'owner@example.test' } }
        : { ok: false, error: 'AUTH_REQUIRED' };
    },
    logoutCookie() { return '__Host-hafize_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'; }
  };
}

function request(body, { peer = '203.0.113.10', contentType = 'application/json', declaredLength } = {}) {
  const encoded = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  return {
    headers: {
      'content-type': contentType,
      ...(declaredLength == null ? {} : { 'content-length': String(declaredLength) })
    },
    socket: { remoteAddress: peer },
    async *[Symbol.asyncIterator]() { yield encoded; },
    resume() {}
  };
}

async function handleLogin(runtime, req, origin = 'https://hafize.example.test') {
  return runtime.handle({
    request: req,
    method: 'POST',
    pathname: '/api/session/login',
    headers: { ...req.headers, origin }
  });
}

{
  const runtime = createCloudSessionNodeServerRuntime({ env: {} });
  assert.equal(runtime.configured, false);
  assert.equal(runtime.authenticator, null);
  assert.equal((await runtime.handle({ pathname: '/api/session/login' })).status, 404);
  assert.deepEqual(await runtime.handle({ pathname: '/api/other' }), { matched: false });
}

assert.throws(
  () => createCloudSessionNodeServerRuntime({ env: { [CLOUD_SESSION_SERVER_ENV.subject]: 'partial' } }),
  /INVALID_CLOUD_SESSION_SERVER:partialConfig/
);
assert.throws(
  () => createCloudSessionNodeServerRuntime({ env: { ...baseEnv, [CLOUD_SESSION_SERVER_ENV.ttlMs]: 'not-a-number' }, createAuth: fakeAuthFactory }),
  /HAFIZE_CLOUD_SESSION_TTL_MS/
);

{
  const runtime = createCloudSessionNodeServerRuntime({
    env: baseEnv,
    createAuth: fakeAuthFactory,
    loginAttempts: 2,
    loginWindowMs: 60_000,
    maxRateKeys: 16
  });
  assert.equal(runtime.configured, true);
  assert.equal(typeof runtime.authenticator.authenticate, 'function');

  for (let index = 0; index < 5; index += 1) {
    const rejected = await handleLogin(runtime, request({ password: 'valid password value' }), 'https://evil.example');
    assert.equal(rejected.status, 403, 'cross-origin requests must fail before consuming login budget');
  }

  assert.equal((await handleLogin(runtime, request({ password: 'valid password value' }))).status, 200);
  assert.equal((await handleLogin(runtime, request({ password: 'wrong password value' }))).status, 401);
  assert.equal((await handleLogin(runtime, request({ password: 'wrong password value' }))).status, 401);
  const limited = await handleLogin(runtime, request({ password: 'valid password value' }));
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error, 'RATE_LIMITED');
  assert.equal(limited.headers['retry-after'], '60');
  assert.equal((await handleLogin(runtime, request({ password: 'valid password value' }, { peer: '203.0.113.11' }))).status, 200);
}

{
  let current = 1000;
  const runtime = createCloudSessionNodeServerRuntime({
    env: baseEnv,
    createAuth: fakeAuthFactory,
    now: () => current,
    loginAttempts: 1,
    loginWindowMs: 1000,
    maxRateKeys: 16
  });
  assert.equal((await handleLogin(runtime, request({ password: 'valid password value' }))).status, 200);
  assert.equal((await handleLogin(runtime, request({ password: 'valid password value' }))).status, 200, 'successful auth must reset its peer bucket');
  assert.equal((await handleLogin(runtime, request({ password: 'wrong password value' }))).status, 401);
  assert.equal((await handleLogin(runtime, request({ password: 'valid password value' }))).status, 429);
  current = 2000;
  assert.equal((await handleLogin(runtime, request({ password: 'valid password value' }))).status, 200, 'window expiry must restore budget');
}

{
  const runtime = createCloudSessionNodeServerRuntime({ env: baseEnv, createAuth: fakeAuthFactory, bodyMaxBytes: 256 });
  const declared = await handleLogin(runtime, request({ password: 'valid password value' }, { declaredLength: 257 }));
  assert.equal(declared.status, 413);
  assert.equal(declared.headers.connection, 'close');

  const streamed = await handleLogin(runtime, request(JSON.stringify({ password: 'x'.repeat(400) })));
  assert.equal(streamed.status, 413);

  const media = await handleLogin(runtime, request({ password: 'valid password value' }, { contentType: 'text/plain' }));
  assert.equal(media.status, 415);
}

{
  const runtime = createCloudSessionNodeServerRuntime({ env: baseEnv, createAuth: fakeAuthFactory, bodyTimeoutMs: 10 });
  const slow = {
    headers: { 'content-type': 'application/json' },
    socket: { remoteAddress: '198.51.100.3' },
    async *[Symbol.asyncIterator]() {
      await new Promise((resolve) => setTimeout(resolve, 30));
      yield Buffer.from('{"password":"valid password value"}');
    },
    resume() {}
  };
  const result = await handleLogin(runtime, slow);
  assert.equal(result.status, 408);
  assert.equal(result.body.error, 'REQUEST_TIMEOUT');
  assert.equal(result.headers.connection, 'close');
}

{
  const runtime = createCloudSessionNodeServerRuntime({ env: baseEnv, createAuth: fakeAuthFactory });
  const status = await runtime.handle({ method: 'GET', pathname: '/api/session/status', headers: { cookie: '__Host-hafize_session=signed' } });
  assert.equal(status.status, 200);
  assert.deepEqual(status.body, { authenticated: true, expiresAt: 9999 });
  assert.equal('principal' in status.body, false);

  const logout = await runtime.handle({ method: 'POST', pathname: '/api/session/logout', headers: { origin: 'https://hafize.example.test', cookie: '__Host-hafize_session=signed' } });
  assert.equal(logout.status, 200);
  assert.match(logout.headers['set-cookie'], /Max-Age=0/);
}

console.log('cloud session Node server runtime tests passed');