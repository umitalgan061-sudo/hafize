import assert from 'node:assert/strict';
import { createCloudSessionNodeServerRuntime, CLOUD_SESSION_SERVER_LIMITS } from '../lib/cloud-session-node-server-runtime.mjs';

function request(body, address) {
  const encoded = Buffer.from(JSON.stringify(body));
  return {
    socket: { remoteAddress: address },
    async *[Symbol.asyncIterator]() { yield encoded; },
    resume() {}
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

const firstLogin = deferred();
let loginCalls = 0;
const runtime = createCloudSessionNodeServerRuntime({
  env: {
    HAFIZE_CLOUD_SESSION_PASSWORD_HASH: 'stub-hash',
    HAFIZE_CLOUD_SESSION_SIGNING_KEY: 'stub-key',
    HAFIZE_CLOUD_SESSION_SUBJECT: 'owner-1',
    HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example'
  },
  loginConcurrency: 1,
  loginAttempts: 2,
  createAuth() {
    return Object.freeze({
      async login() {
        loginCalls += 1;
        if (loginCalls === 1) return firstLogin.promise;
        return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
      },
      authenticate() { return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' }); },
      revoke() { return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' }); },
      logoutCookie() { return '__Host-hafize_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'; }
    });
  }
});
assert.equal(runtime.configured, true);
assert.equal(CLOUD_SESSION_SERVER_LIMITS.defaultLoginConcurrency, 2);
assert.equal(CLOUD_SESSION_SERVER_LIMITS.maxLoginConcurrency, 16);

const headers = Object.freeze({
  origin: 'https://hafize.example',
  'content-type': 'application/json'
});
const firstPromise = runtime.handle({
  request: request({ password: 'first-valid-password' }, '192.0.2.10'),
  method: 'POST',
  pathname: '/api/session/login',
  headers
});
await Promise.resolve();
await Promise.resolve();
assert.equal(loginCalls, 1);

const busy = await runtime.handle({
  request: request({ password: 'second-valid-password' }, '192.0.2.11'),
  method: 'POST',
  pathname: '/api/session/login',
  headers
});
assert.equal(busy.status, 503);
assert.equal(busy.body.error, 'SESSION_AUTH_BUSY');
assert.equal(busy.headers['retry-after'], '1');
assert.equal(loginCalls, 1);

firstLogin.resolve(Object.freeze({
  ok: true,
  expiresAt: 1000,
  setCookie: '__Host-hafize_session=token; Path=/; Max-Age=60; HttpOnly; Secure; SameSite=Strict'
}));
const first = await firstPromise;
assert.equal(first.status, 200);

const afterRelease = await runtime.handle({
  request: request({ password: 'third-valid-password' }, '192.0.2.11'),
  method: 'POST',
  pathname: '/api/session/login',
  headers
});
assert.equal(afterRelease.status, 401);
assert.equal(loginCalls, 2);

// The busy request must not consume the per-peer failure budget. The same peer
// therefore still gets one real credential attempt before its second failure.
const anotherFailure = await runtime.handle({
  request: request({ password: 'fourth-valid-password' }, '192.0.2.11'),
  method: 'POST',
  pathname: '/api/session/login',
  headers
});
assert.equal(anotherFailure.status, 401);
assert.equal(loginCalls, 3);

const rateLimited = await runtime.handle({
  request: request({ password: 'fifth-valid-password' }, '192.0.2.11'),
  method: 'POST',
  pathname: '/api/session/login',
  headers
});
assert.equal(rateLimited.status, 429);
assert.equal(rateLimited.body.error, 'RATE_LIMITED');
assert.equal(loginCalls, 3);

for (const value of [0, 17, 1.5, 'abc']) {
  assert.throws(
    () => createCloudSessionNodeServerRuntime({
      env: {
        HAFIZE_CLOUD_SESSION_PASSWORD_HASH: 'stub-hash',
        HAFIZE_CLOUD_SESSION_SIGNING_KEY: 'stub-key',
        HAFIZE_CLOUD_SESSION_SUBJECT: 'owner-1',
        HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example'
      },
      loginConcurrency: value,
      createAuth: () => ({ login() {}, authenticate() {}, revoke() {}, logoutCookie() {} })
    }),
    /INVALID_CLOUD_SESSION_SERVER:loginConcurrency/
  );
}

process.stdout.write('cloud session login concurrency node runtime tests passed\n');
