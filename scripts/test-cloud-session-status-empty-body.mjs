import assert from 'node:assert/strict';
import { createCloudSessionHttpApi } from '../lib/cloud-session-http-api.mjs';

let authenticateCalls = 0;
const auth = {
  async login() { return { ok: false }; },
  authenticate() { authenticateCalls += 1; return { ok: true, expiresAt: 123 }; },
  logoutCookie() { return 'x=; Max-Age=0'; }
};
const api = createCloudSessionHttpApi({
  auth,
  allowedOrigin: 'https://hafize.example',
  async readJson() { throw new Error('status_must_not_read_body'); }
});

const ok = await api.handle({ method: 'GET', pathname: '/api/session/status', headers: { 'content-length': '0' } });
assert.equal(ok.status, 200);
assert.equal(ok.body.authenticated, true);
assert.equal(authenticateCalls, 1);

for (const headers of [
  { 'content-length': '1' },
  { 'content-length': '00' },
  { 'transfer-encoding': 'chunked' },
  { 'content-encoding': 'gzip' },
  { 'content-length': '0', 'transfer-encoding': 'chunked' }
]) {
  const before = authenticateCalls;
  const result = await api.handle({ method: 'GET', pathname: '/api/session/status', headers });
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: 'INVALID_REQUEST' });
  assert.equal(result.headers.connection, 'close');
  assert.equal(authenticateCalls, before, 'auth must not run for ambiguous status framing');
}

const method = await api.handle({ method: 'POST', pathname: '/api/session/status', headers: { 'content-length': '1' } });
assert.equal(method.status, 405, 'method rejection remains earlier than body policy');
assert.equal(authenticateCalls, 1);

console.log('cloud session status empty-body boundary: ok');
