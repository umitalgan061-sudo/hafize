import assert from 'node:assert/strict';
import { createCloudSessionNodeServerRuntime, CLOUD_SESSION_SERVER_ENV } from '../lib/cloud-session-node-server-runtime.mjs';

const ORIGIN = 'https://hafize.example.test';
const env = {
  [CLOUD_SESSION_SERVER_ENV.passwordHash]: 'placeholder-password-hash',
  [CLOUD_SESSION_SERVER_ENV.signingKey]: 'placeholder-signing-key',
  [CLOUD_SESSION_SERVER_ENV.subject]: 'owner@example.test',
  [CLOUD_SESSION_SERVER_ENV.origin]: ORIGIN
};

function makeHarness({ attempts = 10 } = {}) {
  let loginCalls = 0;
  const auth = {
    async login() { loginCalls += 1; return { ok: false, error: 'AUTH_REQUIRED' }; },
    authenticate() { return { ok: false, error: 'AUTH_REQUIRED' }; },
    revoke() { return { ok: false, error: 'AUTH_REQUIRED' }; },
    logoutCookie() { return '__Host-hafize_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'; }
  };
  const runtime = createCloudSessionNodeServerRuntime({
    env,
    createAuth: () => auth,
    loginAttempts: attempts,
    loginWindowMs: 60_000,
    maxRateKeys: 16
  });
  return { runtime, loginCalls: () => loginCalls };
}

function requestFrom(buffer, { length, peer = '203.0.113.22' } = {}) {
  return {
    headers: {
      'content-type': 'application/json',
      ...(length == null ? {} : { 'content-length': String(length) })
    },
    socket: { remoteAddress: peer },
    async *[Symbol.asyncIterator]() { yield buffer; },
    resume() {}
  };
}

async function login(runtime, request) {
  return runtime.handle({
    request,
    method: 'POST',
    pathname: '/api/session/login',
    headers: { ...request.headers, origin: ORIGIN }
  });
}

const body = Buffer.from('{"password":"value"}');

{
  const harness = makeHarness();
  const result = await login(harness.runtime, requestFrom(body, { length: body.length }));
  assert.equal(result.status, 401);
  assert.equal(harness.loginCalls(), 1);
}

for (const declared of [body.length - 1, body.length + 1, 0]) {
  const harness = makeHarness();
  const result = await login(harness.runtime, requestFrom(body, { length: declared }));
  assert.equal(result.status, 400, `declared ${declared} must not describe ${body.length} received bytes`);
  assert.equal(result.body.error, 'INVALID_REQUEST');
  assert.equal(result.headers.connection, 'close');
  assert.equal(harness.loginCalls(), 0);
}

{
  const harness = makeHarness();
  const oversizedDeclaration = await login(harness.runtime, requestFrom(body, { length: 1025 }));
  assert.equal(oversizedDeclaration.status, 413, 'oversized declaration must be rejected before reading body');
  assert.equal(oversizedDeclaration.body.error, 'BODY_TOO_LARGE');
  assert.equal(oversizedDeclaration.headers.connection, 'close');
  assert.equal(harness.loginCalls(), 0);
}

for (const invalid of ['-1', '+1', '1.0', ' 20', '20 ', '1e3', 'NaN']) {
  const harness = makeHarness();
  const req = requestFrom(body);
  req.headers['content-length'] = invalid;
  const result = await login(harness.runtime, req);
  assert.equal(result.status, 500, `noncanonical Content-Length ${JSON.stringify(invalid)} must fail closed`);
  assert.equal(result.body.error, 'SESSION_AUTH_FAILED');
  assert.equal(harness.loginCalls(), 0);
}

{
  const harness = makeHarness({ attempts: 2 });
  const peer = '198.51.100.44';
  for (let index = 0; index < 2; index += 1) {
    const malformed = Buffer.concat([Buffer.from('{"password":"'), Buffer.from([0xff]), Buffer.from('"}')]);
    const rejected = await login(harness.runtime, requestFrom(malformed, { length: malformed.length, peer }));
    assert.equal(rejected.status, 400);
  }
  const limited = await login(harness.runtime, requestFrom(body, { length: body.length, peer }));
  assert.equal(limited.status, 429, 'malformed auth bodies must still consume the peer abuse budget');
  assert.equal(limited.body.error, 'RATE_LIMITED');
  assert.equal(harness.loginCalls(), 0, 'rate limit must fire before password verification');
}

console.log('cloud session body length integrity tests passed');