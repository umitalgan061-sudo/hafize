import assert from 'node:assert/strict';
import { createCloudSessionHttpApi } from '../lib/cloud-session-http-api.mjs';

let touched = 0;
const api = createCloudSessionHttpApi({
  auth: {
    async login() { touched += 1; return { ok: false }; },
    authenticate() { touched += 1; return { ok: false }; },
    revoke() { touched += 1; return { ok: false }; },
    logoutCookie() { touched += 1; return 'secret-cookie'; }
  },
  allowedOrigin: 'https://hafize.example',
  async readJson() { touched += 1; return { password: 'super-secret-password' }; }
});

const cases = [
  { method: 'GET', pathname: '/api/session/status', headers: { 'content-length': '17' } },
  { method: 'GET', pathname: '/api/session/status', headers: { 'transfer-encoding': 'chunked' } },
  { method: 'POST', pathname: '/api/session/logout', headers: { origin: 'https://hafize.example', 'content-length': '4' } },
  { method: 'POST', pathname: '/api/session/logout', headers: { origin: 'https://hafize.example', 'content-encoding': 'gzip' } }
];

for (const input of cases) {
  const result = await api.handle(input);
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: 'INVALID_REQUEST' });
  assert.equal(result.headers.connection, 'close');
  const wire = JSON.stringify(result);
  assert.equal(wire.includes('CLOUD_SESSION_BODY_NOT_ALLOWED'), false);
  assert.equal(wire.includes('super-secret-password'), false);
  assert.equal(wire.includes('secret-cookie'), false);
}
assert.equal(touched, 0, 'rejected body framing must not invoke auth/body dependencies');

console.log('cloud session empty-body public error policy: ok');
