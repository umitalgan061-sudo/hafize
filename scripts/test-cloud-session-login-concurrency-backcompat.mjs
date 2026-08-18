import assert from 'node:assert/strict';
import { createCloudSessionHttpApi } from '../lib/cloud-session-http-api.mjs';

let loginCalls = 0;
const api = createCloudSessionHttpApi({
  auth: {
    async login() { loginCalls += 1; return { ok: false, error: 'AUTH_REQUIRED' }; },
    authenticate() { return { ok: false, error: 'AUTH_REQUIRED' }; },
    logoutCookie() { return 'clear'; }
  },
  allowedOrigin: 'https://hafize.example',
  async readJson() { return { password: 'valid-shape-password' }; },
  loginGate() { return { ok: true, complete() { return true; } }; }
});

const response = await api.handle({
  request: {},
  method: 'POST',
  pathname: '/api/session/login',
  headers: { origin: 'https://hafize.example', 'content-type': 'application/json' }
});
assert.equal(response.status, 401);
assert.equal(loginCalls, 1, 'optional verification gate keeps direct HTTP API callers compatible');

assert.throws(
  () => createCloudSessionHttpApi({
    auth: { login() {}, authenticate() {}, logoutCookie() {} },
    allowedOrigin: 'https://hafize.example',
    readJson() {},
    verificationGate: {}
  }),
  /INVALID_CLOUD_SESSION_HTTP:verificationGate/
);

process.stdout.write('cloud session login concurrency compatibility tests passed\n');
