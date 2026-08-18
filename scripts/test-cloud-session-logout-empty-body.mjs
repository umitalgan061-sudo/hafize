import assert from 'node:assert/strict';
import { createCloudSessionHttpApi } from '../lib/cloud-session-http-api.mjs';

let revokeCalls = 0;
let logoutCookieCalls = 0;
const auth = {
  async login() { return { ok: false }; },
  authenticate() { return { ok: false }; },
  revoke() { revokeCalls += 1; return { ok: true }; },
  logoutCookie() { logoutCookieCalls += 1; return '__Host-hafize_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'; }
};
const api = createCloudSessionHttpApi({
  auth,
  allowedOrigin: 'https://hafize.example',
  async readJson() { throw new Error('logout_must_not_read_json'); }
});

const ok = await api.handle({
  method: 'POST',
  pathname: '/api/session/logout',
  headers: { origin: 'https://hafize.example', 'content-length': '0' }
});
assert.equal(ok.status, 200);
assert.equal(ok.body.authenticated, false);
assert.equal(revokeCalls, 1);
assert.equal(logoutCookieCalls, 1);

for (const headers of [
  { origin: 'https://hafize.example', 'content-length': '1' },
  { origin: 'https://hafize.example', 'content-length': '0', 'transfer-encoding': 'chunked' },
  { origin: 'https://hafize.example', 'content-encoding': 'br' },
  { origin: 'https://hafize.example', 'transfer-encoding': 'chunked' }
]) {
  const beforeRevoke = revokeCalls;
  const beforeCookie = logoutCookieCalls;
  const result = await api.handle({ method: 'POST', pathname: '/api/session/logout', headers });
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: 'INVALID_REQUEST' });
  assert.equal(result.headers.connection, 'close');
  assert.equal(revokeCalls, beforeRevoke, 'revocation must not run for framed logout');
  assert.equal(logoutCookieCalls, beforeCookie, 'clearing cookie must not be issued for rejected logout');
}

const foreign = await api.handle({
  method: 'POST',
  pathname: '/api/session/logout',
  headers: { origin: 'https://evil.example', 'content-length': '99' }
});
assert.equal(foreign.status, 403, 'Origin gate remains first for state-changing logout');
assert.equal(revokeCalls, 1);

console.log('cloud session logout empty-body boundary: ok');
