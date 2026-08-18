import assert from 'node:assert/strict';
import { createCloudSessionNodeServerRuntime, CLOUD_SESSION_SERVER_ENV } from '../lib/cloud-session-node-server-runtime.mjs';

const ORIGIN = 'https://hafize.example.test';
const env = {
  [CLOUD_SESSION_SERVER_ENV.passwordHash]: 'placeholder-password-hash',
  [CLOUD_SESSION_SERVER_ENV.signingKey]: 'placeholder-signing-key',
  [CLOUD_SESSION_SERVER_ENV.subject]: 'owner@example.test',
  [CLOUD_SESSION_SERVER_ENV.origin]: ORIGIN
};

function authSpy() {
  const state = { loginCalls: 0 };
  return {
    state,
    auth: {
      async login() {
        state.loginCalls += 1;
        return { ok: false, error: 'AUTH_REQUIRED' };
      },
      authenticate() { return { ok: false, error: 'AUTH_REQUIRED' }; },
      revoke() { return { ok: false, error: 'AUTH_REQUIRED' }; },
      logoutCookie() { return '__Host-hafize_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'; }
    }
  };
}

function requestFrom(buffer, headers = {}) {
  return {
    headers: { 'content-type': 'application/json', ...headers },
    socket: { remoteAddress: '203.0.113.20' },
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

function runtimeWithSpy() {
  const holder = authSpy();
  const runtime = createCloudSessionNodeServerRuntime({
    env,
    createAuth: () => holder.auth,
    loginAttempts: 10,
    maxRateKeys: 16
  });
  return { runtime, holder };
}

{
  const { runtime, holder } = runtimeWithSpy();
  const body = Buffer.from('{"password":"geçerli şifre 🔐"}', 'utf8');
  const result = await login(runtime, requestFrom(body, { 'content-length': String(body.length) }));
  assert.equal(result.status, 401, 'valid UTF-8 must reach authentication');
  assert.equal(holder.state.loginCalls, 1);
}

{
  const { runtime, holder } = runtimeWithSpy();
  const invalid = Buffer.concat([
    Buffer.from('{"password":"prefix'),
    Buffer.from([0xc3, 0x28]),
    Buffer.from('"}')
  ]);
  const result = await login(runtime, requestFrom(invalid, { 'content-length': String(invalid.length) }));
  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'INVALID_REQUEST');
  assert.equal(holder.state.loginCalls, 0, 'invalid UTF-8 must be rejected before password verification');
}

{
  const { runtime, holder } = runtimeWithSpy();
  const bom = Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from('{"password":"value"}')
  ]);
  const result = await login(runtime, requestFrom(bom));
  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'INVALID_REQUEST');
  assert.equal(holder.state.loginCalls, 0, 'UTF-8 BOM must not create an alternate JSON byte representation');
}

{
  const { runtime, holder } = runtimeWithSpy();
  const truncated = Buffer.from([0x7b, 0x22, 0x70, 0x61, 0x73, 0x73, 0x77, 0x6f, 0x72, 0x64, 0x22, 0x3a, 0x22, 0xe2, 0x82]);
  const result = await login(runtime, requestFrom(truncated));
  assert.equal(result.status, 400);
  assert.equal(holder.state.loginCalls, 0, 'truncated multi-byte sequences must fail closed');
}

console.log('cloud session strict UTF-8 body tests passed');