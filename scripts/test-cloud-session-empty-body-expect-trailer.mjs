import assert from 'node:assert/strict';
import { createCloudSessionHttpApi } from '../lib/cloud-session-http-api.mjs';
import { requireEmptyCloudSessionBody } from '../lib/cloud-session-empty-body-policy.mjs';

for (const headers of [
  { expect: '100-continue' },
  { Expect: '100-continue' },
  { trailer: 'Digest' },
  { Trailer: 'X-Checksum' },
  { expect: ['100-continue'] },
  { trailer: ['Digest'] }
]) {
  assert.throws(() => requireEmptyCloudSessionBody(headers), (error) => error?.code === 'CLOUD_SESSION_BODY_NOT_ALLOWED');
}
assert.equal(requireEmptyCloudSessionBody({ expect: '', trailer: '', 'content-length': '0' }), true);

let authenticateCalls = 0;
let revokeCalls = 0;
const api = createCloudSessionHttpApi({
  auth: {
    async login() { return { ok: false }; },
    authenticate() { authenticateCalls += 1; return { ok: true, expiresAt: 1 }; },
    revoke() { revokeCalls += 1; return { ok: true }; },
    logoutCookie() { return 'x=; Max-Age=0'; }
  },
  allowedOrigin: 'https://hafize.example',
  async readJson() { return { password: 'unused' }; }
});

for (const headers of [{ expect: '100-continue' }, { trailer: 'Digest' }]) {
  const status = await api.handle({ method: 'GET', pathname: '/api/session/status', headers });
  assert.equal(status.status, 400);
  assert.equal(status.headers.connection, 'close');
}
assert.equal(authenticateCalls, 0);

for (const extra of [{ expect: '100-continue' }, { trailer: 'Digest' }]) {
  const logout = await api.handle({
    method: 'POST',
    pathname: '/api/session/logout',
    headers: { origin: 'https://hafize.example', ...extra }
  });
  assert.equal(logout.status, 400);
  assert.equal(logout.headers.connection, 'close');
}
assert.equal(revokeCalls, 0);

console.log('cloud session expect/trailer empty-body policy: ok');
