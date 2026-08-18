import assert from 'node:assert/strict';
import { createCloudSessionHttpApi } from '../lib/cloud-session-http-api.mjs';
import { createCloudSessionLoginConcurrencyGate } from '../lib/cloud-session-login-concurrency.mjs';

const headers = Object.freeze({ origin: 'https://hafize.example', 'content-type': 'application/json' });
const verification = createCloudSessionLoginConcurrencyGate({ maxConcurrent: 1 });
let calls = 0;
const peerResults = [];
const auth = {
  async login() {
    calls += 1;
    if (calls === 1) throw Object.assign(new Error('internal provider detail'), { code: 'CLOUD_SESSION_AUTH_UNAVAILABLE' });
    return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' });
  },
  authenticate() { return Object.freeze({ ok: false, error: 'AUTH_REQUIRED' }); },
  logoutCookie() { return 'cleared'; }
};
const api = createCloudSessionHttpApi({
  auth,
  allowedOrigin: 'https://hafize.example',
  async readJson(request) { return request.body; },
  loginGate() {
    let done = false;
    return Object.freeze({
      ok: true,
      complete(result) {
        if (done) return false;
        done = true;
        peerResults.push(result);
        return true;
      }
    });
  },
  verificationGate: () => verification.begin()
});

const failed = await api.handle({
  request: { body: { password: 'valid-shape-password-one' } },
  method: 'POST',
  pathname: '/api/session/login',
  headers
});
assert.equal(failed.status, 500);
assert.deepEqual(failed.body, { error: 'SESSION_AUTH_FAILED' });
assert.equal(verification.activeCount(), 0, 'thrown auth must release global slot');
assert.deepEqual(peerResults, [{ authenticated: false, countFailure: true }]);

const next = await api.handle({
  request: { body: { password: 'valid-shape-password-two' } },
  method: 'POST',
  pathname: '/api/session/login',
  headers
});
assert.equal(next.status, 401);
assert.equal(calls, 2);
assert.equal(verification.activeCount(), 0);
assert.deepEqual(peerResults[1], { authenticated: false, countFailure: true });

const foreign = await api.handle({
  request: { body: { password: 'valid-shape-password-three' } },
  method: 'POST',
  pathname: '/api/session/login',
  headers: { ...headers, origin: 'https://evil.example' }
});
assert.equal(foreign.status, 403);
assert.equal(calls, 2);
assert.equal(verification.activeCount(), 0);

process.stdout.write('cloud session login concurrency release tests passed\n');
