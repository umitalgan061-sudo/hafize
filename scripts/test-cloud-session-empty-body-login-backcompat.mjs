import assert from 'node:assert/strict';
import { createCloudSessionHttpApi } from '../lib/cloud-session-http-api.mjs';

let loginCalls = 0;
let readCalls = 0;
let gateCompletes = 0;
const api = createCloudSessionHttpApi({
  auth: {
    async login({ password }) {
      loginCalls += 1;
      assert.equal(password, 'valid-password');
      return { ok: true, expiresAt: 123456, setCookie: '__Host-hafize_session=signed' };
    },
    authenticate() { return { ok: false }; },
    logoutCookie() { return 'x=; Max-Age=0'; }
  },
  allowedOrigin: 'https://hafize.example',
  async readJson() {
    readCalls += 1;
    return { password: 'valid-password' };
  },
  loginGate() {
    return { ok: true, complete() { gateCompletes += 1; } };
  },
  verificationGate() {
    return { ok: true, complete() { gateCompletes += 1; } };
  }
});

const result = await api.handle({
  method: 'POST',
  pathname: '/api/session/login',
  headers: {
    origin: 'https://hafize.example',
    'content-type': 'application/json',
    'content-length': '123',
    'transfer-encoding': 'chunked'
  }
});
assert.equal(result.status, 200, 'empty-body policy must not replace login readJson policy');
assert.equal(result.body.authenticated, true);
assert.equal(readCalls, 1);
assert.equal(loginCalls, 1);
assert.equal(gateCompletes, 2);
assert.equal(result.headers['set-cookie'], '__Host-hafize_session=signed');

console.log('cloud session login body-policy backcompat: ok');
