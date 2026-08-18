import assert from 'node:assert/strict';
import { createHmac, randomBytes, scryptSync } from 'node:crypto';
import { createCloudSessionAuth, CLOUD_SESSION_COOKIE_NAME } from '../lib/cloud-session-auth.mjs';

const NOW = 1_800_000_000_000;
const TTL = 60_000;
const SUBJECT = 'owner:hafize';
const PASSWORD = 'correct horse battery staple';
const salt = randomBytes(16);
const digest = scryptSync(PASSWORD, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const passwordHash = `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}`;
const signingKeyBytes = randomBytes(32);
const signingKey = signingKeyBytes.toString('base64url');
const nonce = 'abcdefghijklmnopqrstuvwx';

function sign(encodedPayload) {
  return createHmac('sha256', signingKeyBytes)
    .update(`hafize-session-v1\0${encodedPayload}`)
    .digest('base64url');
}

function encodeRaw(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function headersForEncodedPayload(encodedPayload) {
  return { cookie: `${CLOUD_SESSION_COOKIE_NAME}=${encodedPayload}.${sign(encodedPayload)}` };
}

const auth = createCloudSessionAuth({
  passwordHash,
  signingKey,
  subject: SUBJECT,
  ttlMs: TTL,
  now: () => NOW,
  randomBytesImpl: () => Buffer.alloc(18, 7)
});

const login = await auth.login({ password: PASSWORD });
assert.equal(login.ok, true);
assert.equal(login.expiresAt, NOW + TTL);
assert.match(login.setCookie, /^__Host-hafize_session=/);
assert.match(login.setCookie, /HttpOnly/);
assert.match(login.setCookie, /Secure/);
assert.match(login.setCookie, /SameSite=Strict/);

const issuedCookie = login.setCookie.split(';', 1)[0];
const authenticated = auth.authenticate({ headers: { cookie: issuedCookie } });
assert.equal(authenticated.ok, true);
assert.equal(authenticated.principal.subject, SUBJECT);
assert.equal(authenticated.expiresAt, NOW + TTL);

const validPayload = { v: 1, sub: SUBJECT, iat: NOW, exp: NOW + TTL, n: nonce };
const canonical = encodeRaw(JSON.stringify(validPayload));
assert.equal(auth.authenticate({ headers: headersForEncodedPayload(canonical) }).ok, true);

const signedButNonCanonical = [
  JSON.stringify({ sub: SUBJECT, v: 1, iat: NOW, exp: NOW + TTL, n: nonce }),
  JSON.stringify(validPayload, null, 2),
  JSON.stringify({ ...validPayload, role: 'admin' }),
  JSON.stringify({ ...validPayload, n: 'a'.repeat(23) }),
  JSON.stringify({ ...validPayload, n: 'a'.repeat(25) }),
  JSON.stringify({ ...validPayload, n: 'contains whitespace!!!!' }),
  JSON.stringify({ ...validPayload, v: 2 }),
  JSON.stringify({ ...validPayload, iat: -1 }),
  JSON.stringify({ ...validPayload, exp: -1 })
];
for (const raw of signedButNonCanonical) {
  const encodedPayload = encodeRaw(raw);
  const result = auth.authenticate({ headers: headersForEncodedPayload(encodedPayload) });
  assert.deepEqual(result, { ok: false, error: 'AUTH_REQUIRED' }, `must reject signed noncanonical payload: ${raw.slice(0, 80)}`);
}

const oversizedRaw = JSON.stringify({
  v: 1,
  sub: SUBJECT,
  iat: NOW,
  exp: NOW + TTL,
  n: nonce,
  padding: 'x'.repeat(1400)
});
const oversizedEncoded = encodeRaw(oversizedRaw);
assert.ok(Buffer.byteLength(oversizedEncoded) > 1024);
assert.deepEqual(auth.authenticate({ headers: headersForEncodedPayload(oversizedEncoded) }), { ok: false, error: 'AUTH_REQUIRED' });

const payloadWithValidSignatureButWrongSubject = encodeRaw(JSON.stringify({ ...validPayload, sub: 'owner:other' }));
assert.deepEqual(auth.authenticate({ headers: headersForEncodedPayload(payloadWithValidSignatureButWrongSubject) }), { ok: false, error: 'AUTH_REQUIRED' });

const expiredPayload = encodeRaw(JSON.stringify({ ...validPayload, iat: NOW - TTL, exp: NOW }));
assert.deepEqual(auth.authenticate({ headers: headersForEncodedPayload(expiredPayload) }), { ok: false, error: 'AUTH_REQUIRED' });

const futurePayload = encodeRaw(JSON.stringify({ ...validPayload, iat: NOW + 1, exp: NOW + TTL + 1 }));
assert.deepEqual(auth.authenticate({ headers: headersForEncodedPayload(futurePayload) }), { ok: false, error: 'AUTH_REQUIRED' });

const wrongDuration = encodeRaw(JSON.stringify({ ...validPayload, exp: NOW + TTL + 1 }));
assert.deepEqual(auth.authenticate({ headers: headersForEncodedPayload(wrongDuration) }), { ok: false, error: 'AUTH_REQUIRED' });

assert.deepEqual(auth.authenticate({ headers: { cookie: `${issuedCookie}; ${issuedCookie}` } }), { ok: false, error: 'AUTH_REQUIRED' });
assert.deepEqual(auth.authenticate({ headers: { cookie: `${CLOUD_SESSION_COOKIE_NAME}=${'x'.repeat(2049)}` } }), { ok: false, error: 'AUTH_REQUIRED' });
assert.deepEqual(auth.authenticate({ headers: { cookie: 'x'.repeat(4097) } }), { ok: false, error: 'AUTH_REQUIRED' });

salt.fill(0);
digest.fill(0);
signingKeyBytes.fill(0);
console.log('cloud session token auth integration tests passed');
