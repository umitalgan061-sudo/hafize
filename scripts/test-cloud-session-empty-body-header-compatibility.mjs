import assert from 'node:assert/strict';
import { requireEmptyCloudSessionBody } from '../lib/cloud-session-empty-body-policy.mjs';
import { createCloudSessionHttpApi } from '../lib/cloud-session-http-api.mjs';

const ordinaryHeaders = {
  accept: 'application/json',
  'accept-language': 'tr-TR,tr;q=0.9',
  'user-agent': 'Hafize-Test/1.0',
  cookie: '__Host-hafize_session=opaque-signed-value',
  'cache-control': 'no-cache',
  pragma: 'no-cache',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-mode': 'cors',
  'x-request-id': 'public-request-id',
  'content-type': 'application/json'
};
assert.equal(requireEmptyCloudSessionBody(ordinaryHeaders), true, 'non-framing headers remain out of scope');

let authenticatedHeaders;
let revokedHeaders;
const api = createCloudSessionHttpApi({
  auth: {
    async login() { return { ok: false }; },
    authenticate({ headers }) { authenticatedHeaders = headers; return { ok: true, expiresAt: 10 }; },
    revoke({ headers }) { revokedHeaders = headers; return { ok: true }; },
    logoutCookie() { return 'x=; Max-Age=0'; }
  },
  allowedOrigin: 'https://hafize.example',
  async readJson() { return {}; }
});

const statusHeaders = { ...ordinaryHeaders, 'content-length': '0' };
const status = await api.handle({ method: 'GET', pathname: '/api/session/status', headers: statusHeaders });
assert.equal(status.status, 200);
assert.equal(authenticatedHeaders, statusHeaders, 'auth receives original headers after framing validation');

const logoutHeaders = {
  ...ordinaryHeaders,
  origin: 'https://hafize.example',
  'content-length': '0',
  'content-encoding': 'identity'
};
const logout = await api.handle({ method: 'POST', pathname: '/api/session/logout', headers: logoutHeaders });
assert.equal(logout.status, 200);
assert.equal(revokedHeaders, logoutHeaders, 'revocation receives original headers after origin/framing validation');

for (const [name, value] of Object.entries(ordinaryHeaders)) {
  assert.equal(value.includes('\r'), false, `${name} fixture must remain a normal header`);
  assert.equal(value.includes('\n'), false, `${name} fixture must remain a normal header`);
}

console.log('cloud session non-framing header compatibility: ok');
