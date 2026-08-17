import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { createCloudSessionAuth } from '../lib/cloud-session-auth.mjs';

const PASSWORD = 'correct-horse-battery-staple';
const SALT_BYTES = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
const SIGNING_KEY = Buffer.alloc(32, 21).toString('base64url');
const SUBJECT = 'bounded-scrypt-user';
const NOW = 1_700_000_000_000;
const N = 16_384;
const r = 8;
const p = 1;
const digest = scryptSync(PASSWORD, SALT_BYTES, 32, {
  N,
  r,
  p,
  maxmem: 32 * 1024 * 1024
});
const passwordHash = `scrypt$${N}$${r}$${p}$${SALT_BYTES.toString('base64url')}$${digest.toString('base64url')}`;

const auth = createCloudSessionAuth({
  passwordHash,
  signingKey: SIGNING_KEY,
  subject: SUBJECT,
  ttlMs: 60_000,
  now: () => NOW,
  randomBytesImpl: () => Buffer.alloc(18, 8)
});

const wrong = await auth.login({ password: 'this-is-definitely-wrong' });
assert.deepEqual(wrong, { ok: false, error: 'AUTH_REQUIRED' });

const loggedIn = await auth.login({ password: PASSWORD });
assert.equal(loggedIn.ok, true);
assert.equal(loggedIn.expiresAt, NOW + 60_000);
assert.match(loggedIn.setCookie, /^__Host-hafize_session=/);
assert.match(loggedIn.setCookie, /HttpOnly/);
assert.match(loggedIn.setCookie, /Secure/);
assert.match(loggedIn.setCookie, /SameSite=Strict/);
assert.match(loggedIn.setCookie, /Max-Age=60/);

const cookiePair = loggedIn.setCookie.split(';', 1)[0];
const authenticated = auth.authenticate({ headers: { cookie: cookiePair } });
assert.equal(authenticated.ok, true);
assert.equal(authenticated.principal.authenticated, true);
assert.equal(authenticated.principal.subject, SUBJECT);
assert.equal(authenticated.expiresAt, NOW + 60_000);

const duplicateCookie = auth.authenticate({
  headers: { cookie: `${cookiePair}; ${cookiePair}` }
});
assert.deepEqual(duplicateCookie, { ok: false, error: 'AUTH_REQUIRED' });

const tamperedCookie = cookiePair.replace(/.$/, (value) => value === 'A' ? 'B' : 'A');
assert.deepEqual(
  auth.authenticate({ headers: { cookie: tamperedCookie } }),
  { ok: false, error: 'AUTH_REQUIRED' }
);

const expiredAuth = createCloudSessionAuth({
  passwordHash,
  signingKey: SIGNING_KEY,
  subject: SUBJECT,
  ttlMs: 60_000,
  now: () => NOW + 60_001,
  randomBytesImpl: () => Buffer.alloc(18, 8)
});
assert.deepEqual(
  expiredAuth.authenticate({ headers: { cookie: cookiePair } }),
  { ok: false, error: 'AUTH_REQUIRED' }
);

console.log('cloud session bounded scrypt login integration: ok');
