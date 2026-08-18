import assert from 'node:assert/strict';
import { createCloudSessionHttpApi } from '../lib/cloud-session-http-api.mjs';

let revoked = false;
let revokeCalls = 0;
const auth = {
  async login() { return { ok: false }; },
  authenticate() {
    return revoked ? { ok: false, error: 'AUTH_REQUIRED' } : { ok: true, expiresAt: 5000 };
  },
  revoke() {
    revokeCalls += 1;
    if (revoked) return { ok: false, error: 'AUTH_REQUIRED' };
    revoked = true;
    return { ok: true };
  },
  logoutCookie() { return '__Host-hafize_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'; }
};
const api = createCloudSessionHttpApi({
  auth,
  allowedOrigin: 'https://hafize.example',
  async readJson() { return {}; }
});

let status = await api.handle({ method: 'GET', pathname: '/api/session/status', headers: {} });
assert.equal(status.status, 200);
assert.equal(status.body.authenticated, true);

const rejected = await api.handle({
  method: 'POST',
  pathname: '/api/session/logout',
  headers: {
    origin: 'https://hafize.example',
    'content-length': '8',
    'content-encoding': 'gzip'
  }
});
assert.equal(rejected.status, 400);
assert.equal(rejected.headers.connection, 'close');
assert.equal(rejected.headers['set-cookie'], undefined);
assert.equal(revokeCalls, 0);
assert.equal(revoked, false);

status = await api.handle({ method: 'GET', pathname: '/api/session/status', headers: { 'content-length': '0' } });
assert.equal(status.status, 200, 'rejected logout must not mutate session state');
assert.equal(status.body.authenticated, true);

const accepted = await api.handle({
  method: 'POST',
  pathname: '/api/session/logout',
  headers: { origin: 'https://hafize.example', 'content-length': '0' }
});
assert.equal(accepted.status, 200);
assert.equal(revokeCalls, 1);
assert.equal(revoked, true);
assert.match(accepted.headers['set-cookie'], /Max-Age=0/);

status = await api.handle({ method: 'GET', pathname: '/api/session/status', headers: {} });
assert.equal(status.status, 401);
assert.equal(status.body.authenticated, false);

console.log('cloud session malformed logout session preservation: ok');
