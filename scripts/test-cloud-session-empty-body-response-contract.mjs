import assert from 'node:assert/strict';
import { createCloudSessionHttpApi } from '../lib/cloud-session-http-api.mjs';

const api = createCloudSessionHttpApi({
  auth: {
    async login() { return { ok: false }; },
    authenticate() { throw new Error('must-not-authenticate'); },
    revoke() { throw new Error('must-not-revoke'); },
    logoutCookie() { throw new Error('must-not-clear'); }
  },
  allowedOrigin: 'https://hafize.example',
  async readJson() { throw new Error('must-not-read'); }
});

for (const input of [
  { method: 'GET', pathname: '/api/session/status', headers: { 'content-length': '2' } },
  { method: 'GET', pathname: '/api/session/status', headers: { expect: '100-continue' } },
  { method: 'POST', pathname: '/api/session/logout', headers: { origin: 'https://hafize.example', trailer: 'Digest' } },
  { method: 'POST', pathname: '/api/session/logout', headers: { origin: 'https://hafize.example', 'transfer-encoding': 'chunked' } }
]) {
  const result = await api.handle(input);
  assert.equal(result.matched, true);
  assert.equal(result.status, 400);
  assert.deepEqual(Object.keys(result.body), ['error']);
  assert.equal(result.body.error, 'INVALID_REQUEST');
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.headers.connection, 'close');
  assert.equal(result.headers['set-cookie'], undefined);
  assert.equal(JSON.stringify(result).includes('CLOUD_SESSION_BODY_NOT_ALLOWED'), false);
}

console.log('cloud session bodyless rejection response contract: ok');
