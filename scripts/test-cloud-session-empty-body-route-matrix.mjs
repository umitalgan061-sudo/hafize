import assert from 'node:assert/strict';
import { createCloudSessionHttpApi } from '../lib/cloud-session-http-api.mjs';

const calls = { login: 0, authenticate: 0, revoke: 0, logoutCookie: 0, readJson: 0 };
const api = createCloudSessionHttpApi({
  auth: {
    async login() { calls.login += 1; return { ok: false }; },
    authenticate() { calls.authenticate += 1; return { ok: true, expiresAt: 99 }; },
    revoke() { calls.revoke += 1; return { ok: true }; },
    logoutCookie() { calls.logoutCookie += 1; return 'x=; Max-Age=0'; }
  },
  allowedOrigin: 'https://hafize.example',
  async readJson() { calls.readJson += 1; return { password: 'wrong' }; }
});

const wrongMethods = [
  ['POST', '/api/session/status'],
  ['PUT', '/api/session/status'],
  ['GET', '/api/session/logout'],
  ['DELETE', '/api/session/logout'],
  ['GET', '/api/session/login']
];
for (const [method, pathname] of wrongMethods) {
  const result = await api.handle({ method, pathname, headers: { origin: 'https://hafize.example', 'content-length': '9' } });
  assert.equal(result.status, 405);
}
assert.deepEqual(calls, { login: 0, authenticate: 0, revoke: 0, logoutCookie: 0, readJson: 0 });

const unknown = await api.handle({ method: 'GET', pathname: '/api/session/unknown', headers: { 'content-length': '9' } });
assert.equal(unknown.matched, false);

const statusOk = await api.handle({ method: 'GET', pathname: '/api/session/status', headers: {} });
assert.equal(statusOk.status, 200);
assert.equal(calls.authenticate, 1);

const statusBad = await api.handle({ method: 'GET', pathname: '/api/session/status', headers: { expect: '100-continue' } });
assert.equal(statusBad.status, 400);
assert.equal(calls.authenticate, 1);

const logoutNoOrigin = await api.handle({ method: 'POST', pathname: '/api/session/logout', headers: { 'content-length': '9' } });
assert.equal(logoutNoOrigin.status, 403);
assert.equal(calls.revoke, 0);

const logoutBadBody = await api.handle({
  method: 'POST',
  pathname: '/api/session/logout',
  headers: { origin: 'https://hafize.example', trailer: 'Digest' }
});
assert.equal(logoutBadBody.status, 400);
assert.equal(calls.revoke, 0);

const logoutOk = await api.handle({
  method: 'POST',
  pathname: '/api/session/logout',
  headers: { origin: 'https://hafize.example', 'content-length': '0' }
});
assert.equal(logoutOk.status, 200);
assert.equal(calls.revoke, 1);
assert.equal(calls.logoutCookie, 1);

console.log('cloud session route/body matrix: ok');
