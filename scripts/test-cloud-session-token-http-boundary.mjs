import assert from 'node:assert/strict';
import { createHmac, randomBytes, scryptSync } from 'node:crypto';
import { createCloudSessionHttpApi } from '../lib/cloud-session-http-api.mjs';
import { createRevocableCloudSessionAuth } from '../lib/cloud-session-revocable-auth.mjs';
import { CLOUD_SESSION_COOKIE_NAME } from '../lib/cloud-session-auth.mjs';

const NOW = 1_800_000_000_000;
const TTL = 60_000;
const ORIGIN = 'https://hafize.example';
const SUBJECT = 'owner:hafize';
const PASSWORD = 'correct horse battery staple';
const salt = randomBytes(16);
const digest = scryptSync(PASSWORD, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const signingKeyBytes = randomBytes(32);
const signingKey = signingKeyBytes.toString('base64url');
const passwordHash = `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}`;

function sign(encodedPayload) {
  return createHmac('sha256', signingKeyBytes).update(`hafize-session-v1\0${encodedPayload}`).digest('base64url');
}

function signedCookie(payload) {
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');
  return `${CLOUD_SESSION_COOKIE_NAME}=${encoded}.${sign(encoded)}`;
}

const auth = createRevocableCloudSessionAuth({
  passwordHash,
  signingKey,
  subject: SUBJECT,
  ttlMs: TTL,
  now: () => NOW,
  randomBytesImpl: () => Buffer.alloc(18, 11)
});
const api = createCloudSessionHttpApi({
  auth,
  allowedOrigin: ORIGIN,
  async readJson(request) {
    return request?.body ?? {};
  }
});

const loginResponse = await api.handle({
  request: { body: { password: PASSWORD } },
  method: 'POST',
  pathname: '/api/session/login',
  headers: { origin: ORIGIN }
});
assert.equal(loginResponse.status, 200);
assert.equal(loginResponse.body.authenticated, true);
assert.match(loginResponse.headers['set-cookie'], /^__Host-hafize_session=/);
const issuedCookie = loginResponse.headers['set-cookie'].split(';', 1)[0];

const status = await api.handle({
  method: 'GET',
  pathname: '/api/session/status',
  headers: { cookie: issuedCookie }
});
assert.equal(status.status, 200);
assert.deepEqual(status.body, { authenticated: true, expiresAt: NOW + TTL });
assert.equal(status.headers['cache-control'], 'no-store');

const malformedSignedPayloads = [
  JSON.stringify({ sub: SUBJECT, v: 1, iat: NOW, exp: NOW + TTL, n: 'abcdefghijklmnopqrstuvwx' }),
  JSON.stringify({ v: 1, sub: SUBJECT, iat: NOW, exp: NOW + TTL, n: 'abcdefghijklmnopqrstuvwx', scope: 'admin' }),
  JSON.stringify({ v: 1, sub: SUBJECT, iat: NOW, exp: NOW + TTL, n: 'short' }),
  JSON.stringify({ v: 1, sub: SUBJECT, iat: NOW, exp: NOW + TTL, n: 'abcdefghijklmnopqrstuvwx' }, null, 2)
];
for (const payload of malformedSignedPayloads) {
  const cookie = signedCookie(payload);
  const rejectedStatus = await api.handle({ method: 'GET', pathname: '/api/session/status', headers: { cookie } });
  assert.equal(rejectedStatus.status, 401);
  assert.deepEqual(rejectedStatus.body, { authenticated: false, error: 'AUTH_REQUIRED' });

  const rejectedLogout = await api.handle({
    method: 'POST',
    pathname: '/api/session/logout',
    headers: { origin: ORIGIN, cookie }
  });
  assert.equal(rejectedLogout.status, 401);
  assert.deepEqual(rejectedLogout.body, { authenticated: false, error: 'AUTH_REQUIRED' });
  assert.equal(rejectedLogout.headers['set-cookie'], undefined);
}

const duplicateStatus = await api.handle({
  method: 'GET',
  pathname: '/api/session/status',
  headers: { cookie: `${issuedCookie}; ${issuedCookie}` }
});
assert.equal(duplicateStatus.status, 401);

const wrongOriginLogout = await api.handle({
  method: 'POST',
  pathname: '/api/session/logout',
  headers: { origin: 'https://evil.example', cookie: issuedCookie }
});
assert.equal(wrongOriginLogout.status, 403);
assert.equal(auth.authenticate({ headers: { cookie: issuedCookie } }).ok, true);

const logout = await api.handle({
  method: 'POST',
  pathname: '/api/session/logout',
  headers: { origin: ORIGIN, cookie: issuedCookie }
});
assert.equal(logout.status, 200);
assert.deepEqual(logout.body, { authenticated: false });
assert.match(logout.headers['set-cookie'], /Max-Age=0/);

const replay = await api.handle({
  method: 'GET',
  pathname: '/api/session/status',
  headers: { cookie: issuedCookie }
});
assert.equal(replay.status, 401);
assert.deepEqual(replay.body, { authenticated: false, error: 'AUTH_REQUIRED' });

salt.fill(0);
digest.fill(0);
signingKeyBytes.fill(0);
console.log('cloud session token HTTP boundary tests passed');
