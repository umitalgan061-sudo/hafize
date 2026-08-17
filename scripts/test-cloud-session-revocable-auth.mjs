import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { createRevocableCloudSessionAuth } from '../lib/cloud-session-revocable-auth.mjs';

const password = 'correct horse battery staple';
const salt = Buffer.alloc(16, 11);
const digest = scryptSync(password, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const passwordHash = `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}`;
const signingKey = Buffer.alloc(32, 19).toString('base64url');
let now = 1_800_000_000_000;
let nonce = 0;
const randomBytesImpl = (size) => {
  assert.equal(size, 18);
  nonce += 1;
  return Buffer.alloc(size, nonce);
};

function cookieHeader(setCookie) {
  return setCookie.split(';', 1)[0];
}

const auth = createRevocableCloudSessionAuth({
  passwordHash,
  signingKey,
  subject: 'user:umit',
  ttlMs: 60_000,
  now: () => now,
  randomBytesImpl
});

const first = await auth.login({ password });
assert.equal(first.ok, true);
const firstCookie = cookieHeader(first.setCookie);
assert.deepEqual(auth.authenticate({ headers: { cookie: firstCookie } }), {
  ok: true,
  principal: { authenticated: true, subject: 'user:umit' },
  expiresAt: now + 60_000
});

const revoked = auth.revoke({ headers: { cookie: firstCookie } });
assert.deepEqual(revoked, { ok: true });
assert.deepEqual(auth.authenticate({ headers: { cookie: firstCookie } }), { ok: false, error: 'AUTH_REQUIRED' });
assert.deepEqual(auth.revoke({ headers: { cookie: firstCookie } }), { ok: false, error: 'AUTH_REQUIRED' });

// A later independent session remains valid: revocation is token-scoped, not subject-scoped.
const second = await auth.login({ password });
assert.equal(second.ok, true);
const secondCookie = cookieHeader(second.setCookie);
assert.notEqual(firstCookie, secondCookie);
assert.equal(auth.authenticate({ headers: { cookie: secondCookie } }).ok, true);

// Duplicate cookies fail closed and must not accidentally revoke the valid token.
assert.deepEqual(
  auth.revoke({ headers: { cookie: `${secondCookie}; ${secondCookie}` } }),
  { ok: false, error: 'AUTH_REQUIRED' }
);
assert.equal(auth.authenticate({ headers: { cookie: secondCookie } }).ok, true);

// Signature corruption is rejected before revocation storage is consulted.
const [name, token] = secondCookie.split('=');
const tampered = `${name}=${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
assert.deepEqual(auth.authenticate({ headers: { cookie: tampered } }), { ok: false, error: 'AUTH_REQUIRED' });
assert.deepEqual(auth.revoke({ headers: { cookie: tampered } }), { ok: false, error: 'AUTH_REQUIRED' });

// Revocation expires with the original token lifetime and cannot extend a session.
assert.deepEqual(auth.revoke({ headers: { cookie: secondCookie } }), { ok: true });
now += 60_000;
assert.deepEqual(auth.authenticate({ headers: { cookie: secondCookie } }), { ok: false, error: 'AUTH_REQUIRED' });

// Invalid passwords never create a token or a revocation entry.
const rejected = await auth.login({ password: 'definitely wrong password' });
assert.deepEqual(rejected, { ok: false, error: 'AUTH_REQUIRED' });

// The wrapper never exposes the raw revocation map or signing key through its public API.
assert.deepEqual(Object.keys(auth).sort(), ['authenticate', 'login', 'logoutCookie', 'revoke']);
assert.equal(JSON.stringify(auth).includes(signingKey), false);
assert.match(auth.logoutCookie(), /^__Host-hafize_session=; Path=\/; Max-Age=0; HttpOnly; Secure; SameSite=Strict$/);

console.log('cloud session revocable auth tests passed');
