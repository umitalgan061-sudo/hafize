import assert from 'node:assert/strict';
import { createCloudSessionNodeServerRuntime, CLOUD_SESSION_SERVER_ENV } from '../lib/cloud-session-node-server-runtime.mjs';

const ORIGIN = 'https://hafize.example.test';
const env = {
  [CLOUD_SESSION_SERVER_ENV.passwordHash]: 'placeholder-password-hash',
  [CLOUD_SESSION_SERVER_ENV.signingKey]: 'placeholder-signing-key',
  [CLOUD_SESSION_SERVER_ENV.subject]: 'owner@example.test',
  [CLOUD_SESSION_SERVER_ENV.origin]: ORIGIN
};

function harness({ bodyTimeoutMs = 20, bodyMaxBytes = 256 } = {}) {
  let loginCalls = 0;
  let verificationBegins = 0;
  const auth = {
    async login() { loginCalls += 1; return { ok: false, error: 'AUTH_REQUIRED' }; },
    authenticate() { return { ok: false, error: 'AUTH_REQUIRED' }; },
    revoke() { return { ok: false, error: 'AUTH_REQUIRED' }; },
    logoutCookie() { return '__Host-hafize_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'; }
  };
  const runtime = createCloudSessionNodeServerRuntime({
    env,
    createAuth: () => auth,
    createVerificationGate: () => ({
      begin() {
        verificationBegins += 1;
        return { ok: true, complete() {} };
      }
    }),
    loginAttempts: 20,
    maxRateKeys: 16,
    bodyTimeoutMs,
    bodyMaxBytes
  });
  return { runtime, loginCalls: () => loginCalls, verificationBegins: () => verificationBegins };
}

async function login(runtime, request) {
  return runtime.handle({
    request,
    method: 'POST',
    pathname: '/api/session/login',
    headers: { ...request.headers, origin: ORIGIN }
  });
}

{
  const state = { returned: 0, resumed: 0 };
  const iterator = {
    async next() {
      await new Promise((resolve) => setTimeout(resolve, 60));
      return { done: false, value: Buffer.from('{"password":"late"}') };
    },
    return() { state.returned += 1; return { done: true }; }
  };
  const request = {
    headers: { 'content-type': 'application/json' },
    socket: { remoteAddress: '198.51.100.50' },
    [Symbol.asyncIterator]() { return iterator; },
    resume() { state.resumed += 1; }
  };
  const h = harness({ bodyTimeoutMs: 10 });
  const result = await login(h.runtime, request);
  assert.equal(result.status, 408);
  assert.equal(result.headers.connection, 'close');
  assert.equal(state.returned, 1, 'timeout should stop the body iterator');
  assert.equal(state.resumed, 1, 'timeout should drain/discard the unsafe request where supported');
  assert.equal(h.loginCalls(), 0);
  assert.equal(h.verificationBegins(), 0, 'slow bodies must not occupy the scrypt verification gate');
}

{
  const state = { returned: 0, resumed: 0 };
  const chunks = [Buffer.alloc(180, 0x20), Buffer.alloc(180, 0x20)];
  const iterator = {
    index: 0,
    async next() {
      if (this.index >= chunks.length) return { done: true };
      return { done: false, value: chunks[this.index++] };
    },
    return() { state.returned += 1; return { done: true }; }
  };
  const request = {
    headers: { 'content-type': 'application/json' },
    socket: { remoteAddress: '198.51.100.51' },
    [Symbol.asyncIterator]() { return iterator; },
    resume() { state.resumed += 1; }
  };
  const h = harness({ bodyMaxBytes: 256 });
  const result = await login(h.runtime, request);
  assert.equal(result.status, 413);
  assert.equal(result.headers.connection, 'close');
  assert.equal(state.returned, 1, 'oversize streaming body should stop consuming request chunks');
  assert.equal(state.resumed, 1);
  assert.equal(h.loginCalls(), 0);
  assert.equal(h.verificationBegins(), 0);
}

{
  const body = Buffer.from('{"password":"wrong"}');
  const request = {
    headers: { 'content-type': 'application/json', 'content-length': String(body.length) },
    socket: { remoteAddress: '198.51.100.52' },
    async *[Symbol.asyncIterator]() { yield body; },
    resume() { throw new Error('valid body must not invoke cleanup resume'); }
  };
  const h = harness();
  const result = await login(h.runtime, request);
  assert.equal(result.status, 401);
  assert.equal(h.verificationBegins(), 1, 'verification capacity is acquired only after a valid bounded body');
  assert.equal(h.loginCalls(), 1);
}

console.log('cloud session body lifecycle tests passed');