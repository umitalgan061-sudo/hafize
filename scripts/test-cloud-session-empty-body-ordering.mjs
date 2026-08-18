import assert from 'node:assert/strict';
import { createCloudSessionHttpApi } from '../lib/cloud-session-http-api.mjs';

const calls = [];
const auth = {
  async login() { calls.push('login'); return { ok: false }; },
  authenticate() { calls.push('authenticate'); return { ok: true, expiresAt: 1 }; },
  revoke() { calls.push('revoke'); return { ok: true }; },
  logoutCookie() { calls.push('logoutCookie'); return 'x=; Max-Age=0'; }
};
const api = createCloudSessionHttpApi({
  auth,
  allowedOrigin: 'https://hafize.example',
  async readJson() { calls.push('readJson'); return { password: 'x' }; }
});

let result = await api.handle({
  method: 'POST',
  pathname: '/api/session/logout',
  headers: { origin: 'https://evil.example', 'transfer-encoding': 'chunked' }
});
assert.equal(result.status, 403);
assert.deepEqual(calls, [], 'foreign origin must not reach framing/auth work');

result = await api.handle({
  method: 'DELETE',
  pathname: '/api/session/logout',
  headers: { origin: 'https://hafize.example', 'transfer-encoding': 'chunked' }
});
assert.equal(result.status, 405);
assert.deepEqual(calls, [], 'wrong method must not reach origin/body/auth work');

result = await api.handle({
  method: 'POST',
  pathname: '/api/session/logout',
  headers: { origin: 'https://hafize.example', 'transfer-encoding': 'chunked' }
});
assert.equal(result.status, 400);
assert.deepEqual(calls, [], 'framing rejection must precede revoke');

result = await api.handle({
  method: 'GET',
  pathname: '/api/session/status',
  headers: { 'content-length': '1' }
});
assert.equal(result.status, 400);
assert.deepEqual(calls, [], 'status framing rejection must precede authenticate');

result = await api.handle({ method: 'GET', pathname: '/api/session/status', headers: {} });
assert.equal(result.status, 200);
assert.deepEqual(calls, ['authenticate']);

console.log('cloud session empty-body gate ordering: ok');
