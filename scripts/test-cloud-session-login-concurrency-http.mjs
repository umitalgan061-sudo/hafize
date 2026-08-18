import assert from 'node:assert/strict';
import { createCloudSessionHttpApi } from '../lib/cloud-session-http-api.mjs';
import { createCloudSessionLoginConcurrencyGate } from '../lib/cloud-session-login-concurrency.mjs';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const pendingLogin = deferred();
let loginCalls = 0;
const auth = {
  async login() {
    loginCalls += 1;
    if (loginCalls === 1) return pendingLogin.promise;
    return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
  },
  authenticate() { return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' }); },
  logoutCookie() { return '__Host-hafize_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'; }
};
const verification = createCloudSessionLoginConcurrencyGate({ maxConcurrent: 1, retryAfterSeconds: 3 });
const peerCompletions = [];
const api = createCloudSessionHttpApi({
  auth,
  allowedOrigin: 'https://hafize.example',
  async readJson(request) { return request.body; },
  loginGate() {
    let completed = false;
    return Object.freeze({
      ok: true,
      complete(result) {
        if (completed) return false;
        completed = true;
        peerCompletions.push(result);
        return true;
      }
    });
  },
  verificationGate: () => verification.begin()
});

const headers = Object.freeze({ origin: 'https://hafize.example', 'content-type': 'application/json' });
const firstPromise = api.handle({
  request: { body: { password: 'correct-horse-battery-staple' } },
  method: 'POST',
  pathname: '/api/session/login',
  headers
});

await Promise.resolve();
assert.equal(loginCalls, 1);
assert.equal(verification.activeCount(), 1);

const busy = await api.handle({
  request: { body: { password: 'another-valid-shape-password' } },
  method: 'POST',
  pathname: '/api/session/login',
  headers
});
assert.equal(busy.status, 503);
assert.deepEqual(busy.body, { error: 'SESSION_AUTH_BUSY' });
assert.equal(busy.headers['retry-after'], '3');
assert.equal(loginCalls, 1, 'busy request must not start password verification');
assert.equal(verification.activeCount(), 1);
assert.deepEqual(peerCompletions[0], { authenticated: false, countFailure: false });

pendingLogin.resolve(Object.freeze({
  ok: true,
  expiresAt: 123456789,
  setCookie: '__Host-hafize_session=token; Path=/; Max-Age=60; HttpOnly; Secure; SameSite=Strict'
}));
const first = await firstPromise;
assert.equal(first.status, 200);
assert.equal(first.body.authenticated, true);
assert.equal(verification.activeCount(), 0);
assert.deepEqual(peerCompletions[1], { authenticated: true, countFailure: true });

const third = await api.handle({
  request: { body: { password: 'wrong-but-valid-shape-password' } },
  method: 'POST',
  pathname: '/api/session/login',
  headers
});
assert.equal(third.status, 401);
assert.equal(loginCalls, 2);
assert.equal(verification.activeCount(), 0);
assert.deepEqual(peerCompletions[2], { authenticated: false, countFailure: true });

const malformedCompletions = [];
const malformedApi = createCloudSessionHttpApi({
  auth,
  allowedOrigin: 'https://hafize.example',
  async readJson() { throw new SyntaxError('bad json'); },
  loginGate() {
    return Object.freeze({
      ok: true,
      complete(result) { malformedCompletions.push(result); return true; }
    });
  },
  verificationGate() { throw new Error('verification gate must not run before body validation'); }
});
const malformed = await malformedApi.handle({ request: {}, method: 'POST', pathname: '/api/session/login', headers });
assert.equal(malformed.status, 400);
assert.deepEqual(malformedCompletions, [{ authenticated: false, countFailure: true }]);

process.stdout.write('cloud session login concurrency HTTP tests passed\n');
