import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { createCloudSessionAuth } from '../lib/cloud-session-auth.mjs';

const PASSWORD = 'zeroize-regression-password';
const SALT = Buffer.from('fedcba98765432100123456789abcdef', 'hex');
const KEY = Buffer.alloc(32, 13).toString('base64url');
const N = 16_384;
const r = 8;
const p = 1;
const digest = scryptSync(PASSWORD, SALT, 32, { N, r, p, maxmem: 32 * 1024 * 1024 });
const passwordHash = `scrypt$${N}$${r}$${p}$${SALT.toString('base64url')}$${digest.toString('base64url')}`;
let now = 10_000_000;

function makeAuth() {
  return createCloudSessionAuth({
    passwordHash,
    signingKey: KEY,
    subject: 'zeroize-user',
    ttlMs: 60_000,
    now: () => now,
    randomBytesImpl: () => Buffer.alloc(18, 6)
  });
}

const auth = makeAuth();
for (const wrong of [
  'wrong-password-value',
  'another-wrong-password',
  'x'.repeat(512)
]) {
  const result = await auth.login({ password: wrong });
  assert.deepEqual(result, { ok: false, error: 'AUTH_REQUIRED' });
}

// Oversized passwords are rejected before scrypt and do not change public error detail.
const oversized = await auth.login({ password: 'ö'.repeat(300) });
assert.deepEqual(oversized, { ok: false, error: 'AUTH_REQUIRED' });
assert.equal(Object.keys(oversized).length, 2);

// A previous failed login must not poison the next valid derivation.
const success = await auth.login({ password: PASSWORD });
assert.equal(success.ok, true);
assert.equal(success.expiresAt, now + 60_000);
const cookiePair = success.setCookie.split(';', 1)[0];
assert.match(cookiePair, /^__Host-hafize_session=/);
assert.equal(auth.authenticate({ headers: { cookie: cookiePair } }).ok, true);

// Authentication remains stateless with respect to password-derivation scratch buffers.
assert.equal(auth.authenticate({ headers: { cookie: cookiePair } }).principal.subject, 'zeroize-user');
now += 60_001;
assert.deepEqual(
  auth.authenticate({ headers: { cookie: cookiePair } }),
  { ok: false, error: 'AUTH_REQUIRED' }
);

// Public behavior for malformed password inputs remains uniform.
for (const malformed of [undefined, null, 123, {}, [], '', 'short']) {
  const result = await makeAuth().login({ password: malformed });
  assert.deepEqual(result, { ok: false, error: 'AUTH_REQUIRED' });
}

console.log('cloud session secret buffer zeroization regression: ok');
