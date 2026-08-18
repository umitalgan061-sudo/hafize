import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import {
  CLOUD_SESSION_REVOCATION_LIMITS,
  createCloudSessionRevocationStore,
  createRevocableCloudSessionAuth,
  fingerprintCloudSessionToken,
  readCloudSessionToken
} from '../lib/cloud-session-revocable-auth.mjs';
import { CLOUD_SESSION_COOKIE_NAME } from '../lib/cloud-session-auth.mjs';
import { CLOUD_SESSION_TOKEN_CONTRACT } from '../lib/cloud-session-token-contract.mjs';

const NOW = 1_800_000_000_000;
const TTL = 60_000;
const PASSWORD = 'correct horse battery staple';
const SUBJECT = 'owner:hafize';
const salt = randomBytes(16);
const digest = scryptSync(PASSWORD, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const activeKeyBytes = randomBytes(32);
const previousKeyBytes = randomBytes(32);
const activeKey = activeKeyBytes.toString('base64url');
const previousKey = previousKeyBytes.toString('base64url');
const passwordHash = `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}`;
const store = createCloudSessionRevocationStore({ now: () => NOW });

function cookieFromSetCookie(setCookie) {
  return setCookie.split(';', 1)[0];
}

function tokenFromCookie(cookie) {
  return cookie.slice(COOKIE_NAME_PREFIX.length);
}

const COOKIE_NAME_PREFIX = `${CLOUD_SESSION_COOKIE_NAME}=`;
const oldAuth = createRevocableCloudSessionAuth({
  passwordHash,
  signingKey: previousKey,
  subject: SUBJECT,
  ttlMs: TTL,
  now: () => NOW,
  revocationStore: store,
  randomBytesImpl: () => Buffer.alloc(18, 9)
});
const oldLogin = await oldAuth.login({ password: PASSWORD });
assert.equal(oldLogin.ok, true);
const oldCookie = cookieFromSetCookie(oldLogin.setCookie);
const oldToken = tokenFromCookie(oldCookie);

const rotatedAuth = createRevocableCloudSessionAuth({
  passwordHash,
  signingKey: activeKey,
  previousSigningKey: previousKey,
  subject: SUBJECT,
  ttlMs: TTL,
  now: () => NOW,
  revocationStore: store,
  randomBytesImpl: () => Buffer.alloc(18, 10)
});

assert.equal(rotatedAuth.authenticate({ headers: { cookie: oldCookie } }).ok, true);
assert.equal(readCloudSessionToken({ cookie: oldCookie }), oldToken);
const oldFingerprint = fingerprintCloudSessionToken(previousKey, oldToken);
assert.match(oldFingerprint, /^[A-Za-z0-9_-]{43}$/);

const revoked = rotatedAuth.revoke({ headers: { cookie: oldCookie } });
assert.deepEqual(revoked, { ok: true });
assert.equal(store.isRevoked(oldFingerprint), true);
assert.deepEqual(rotatedAuth.authenticate({ headers: { cookie: oldCookie } }), { ok: false, error: 'AUTH_REQUIRED' });

const freshLogin = await rotatedAuth.login({ password: PASSWORD });
assert.equal(freshLogin.ok, true);
const freshCookie = cookieFromSetCookie(freshLogin.setCookie);
assert.equal(rotatedAuth.authenticate({ headers: { cookie: freshCookie } }).ok, true);
assert.notEqual(freshCookie, oldCookie);

assert.equal(readCloudSessionToken({ cookie: `${oldCookie}; ${oldCookie}` }), null);
assert.deepEqual(rotatedAuth.authenticate({ headers: { cookie: `${oldCookie}; ${oldCookie}` } }), { ok: false, error: 'AUTH_REQUIRED' });
assert.deepEqual(rotatedAuth.revoke({ headers: { cookie: `${oldCookie}; ${oldCookie}` } }), { ok: false, error: 'AUTH_REQUIRED' });

const oversizedToken = 'x'.repeat(CLOUD_SESSION_TOKEN_CONTRACT.maxTokenBytes + 1);
assert.equal(readCloudSessionToken({ cookie: `${CLOUD_SESSION_COOKIE_NAME}=${oversizedToken}` }), null);
assert.deepEqual(rotatedAuth.authenticate({ headers: { cookie: `${CLOUD_SESSION_COOKIE_NAME}=${oversizedToken}` } }), { ok: false, error: 'AUTH_REQUIRED' });
assert.deepEqual(rotatedAuth.revoke({ headers: { cookie: `${CLOUD_SESSION_COOKIE_NAME}=${oversizedToken}` } }), { ok: false, error: 'AUTH_REQUIRED' });
assert.throws(() => fingerprintCloudSessionToken(activeKey, oversizedToken), /INVALID_CLOUD_SESSION_REVOCATION:token/);

assert.equal(CLOUD_SESSION_REVOCATION_LIMITS.maxCookieBytes, CLOUD_SESSION_TOKEN_CONTRACT.maxCookieHeaderBytes);
assert.equal(CLOUD_SESSION_REVOCATION_LIMITS.maxTokenBytes, CLOUD_SESSION_TOKEN_CONTRACT.maxTokenBytes);

salt.fill(0);
digest.fill(0);
activeKeyBytes.fill(0);
previousKeyBytes.fill(0);
console.log('cloud session token revocation rotation tests passed');
