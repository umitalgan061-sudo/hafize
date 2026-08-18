import assert from 'node:assert/strict';
import { createHmac, randomBytes, scryptSync } from 'node:crypto';
import { createCloudSessionAuth, CLOUD_SESSION_COOKIE_NAME } from '../lib/cloud-session-auth.mjs';

const NOW = 1_800_000_000_000;
const TTL = 60_000;
const SUBJECT = 'owner:hafize';
const PASSWORD = 'correct horse battery staple';
const nonce = 'abcdefghijklmnopqrstuvwx';
const salt = randomBytes(16);
const digest = scryptSync(PASSWORD, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const activeBytes = randomBytes(32);
const previousBytes = randomBytes(32);
const activeKey = activeBytes.toString('base64url');
const previousKey = previousBytes.toString('base64url');
const passwordHash = `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}`;

function signedCookie(rawPayload, keyBytes) {
  const encoded = Buffer.from(rawPayload, 'utf8').toString('base64url');
  const signature = createHmac('sha256', keyBytes)
    .update(`hafize-session-v1\0${encoded}`)
    .digest('base64url');
  return `${CLOUD_SESSION_COOKIE_NAME}=${encoded}.${signature}`;
}

const rotating = createCloudSessionAuth({
  passwordHash,
  signingKey: activeKey,
  previousSigningKey: previousKey,
  subject: SUBJECT,
  ttlMs: TTL,
  now: () => NOW
});
const retired = createCloudSessionAuth({
  passwordHash,
  signingKey: activeKey,
  subject: SUBJECT,
  ttlMs: TTL,
  now: () => NOW
});

const canonical = JSON.stringify({ v: 1, sub: SUBJECT, iat: NOW, exp: NOW + TTL, n: nonce });
const previousCanonicalCookie = signedCookie(canonical, previousBytes);
const acceptedPrevious = rotating.authenticate({ headers: { cookie: previousCanonicalCookie } });
assert.equal(acceptedPrevious.ok, true);
assert.equal(acceptedPrevious.principal.subject, SUBJECT);
assert.equal(acceptedPrevious.expiresAt, NOW + TTL);
assert.deepEqual(retired.authenticate({ headers: { cookie: previousCanonicalCookie } }), { ok: false, error: 'AUTH_REQUIRED' });

const previousSignedInvalidPayloads = [
  JSON.stringify({ sub: SUBJECT, v: 1, iat: NOW, exp: NOW + TTL, n: nonce }),
  JSON.stringify({ v: 1, sub: SUBJECT, iat: NOW, exp: NOW + TTL, n: nonce, extra: true }),
  JSON.stringify({ v: 1, sub: SUBJECT, iat: NOW, exp: NOW + TTL, n: 'bad' }),
  JSON.stringify({ v: 1, sub: SUBJECT, iat: NOW, exp: NOW + TTL, n: nonce }, null, 2)
];
for (const raw of previousSignedInvalidPayloads) {
  const cookie = signedCookie(raw, previousBytes);
  assert.deepEqual(
    rotating.authenticate({ headers: { cookie } }),
    { ok: false, error: 'AUTH_REQUIRED' },
    `previous signing key must not bypass canonical payload checks: ${raw.slice(0, 80)}`
  );
}

const activeCanonicalCookie = signedCookie(canonical, activeBytes);
assert.equal(rotating.authenticate({ headers: { cookie: activeCanonicalCookie } }).ok, true);
assert.equal(retired.authenticate({ headers: { cookie: activeCanonicalCookie } }).ok, true);

const previousWrongTtl = JSON.stringify({ v: 1, sub: SUBJECT, iat: NOW, exp: NOW + TTL + 1, n: nonce });
assert.deepEqual(
  rotating.authenticate({ headers: { cookie: signedCookie(previousWrongTtl, previousBytes) } }),
  { ok: false, error: 'AUTH_REQUIRED' }
);

salt.fill(0);
digest.fill(0);
activeBytes.fill(0);
previousBytes.fill(0);
console.log('cloud session previous-key token boundary tests passed');
