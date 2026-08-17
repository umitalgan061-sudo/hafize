import assert from 'node:assert/strict';
import { createHmac, scryptSync } from 'node:crypto';
import { createCloudSessionAuth, CLOUD_SESSION_LIMITS } from '../lib/cloud-session-auth.mjs';

const nowValue = 1_800_000_000_000;
const subject = 'rotation-user';
const password = 'rotation-test-password';
const salt = Buffer.alloc(16, 7);
const digest = scryptSync(password, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const passwordHash = `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}`;
const key1 = Buffer.alloc(32, 1).toString('base64url');
const key2 = Buffer.alloc(32, 2).toString('base64url');
const key3 = Buffer.alloc(32, 3).toString('base64url');
const ttlMs = 60_000;

function cookieToken(setCookie) {
  const value = String(setCookie || '').split(';', 1)[0];
  assert.match(value, /^__Host-hafize_session=/);
  return value.slice('__Host-hafize_session='.length);
}

function headersFor(token) {
  return { cookie: `__Host-hafize_session=${token}` };
}

function sign(key, payload) {
  return createHmac('sha256', Buffer.from(key, 'base64url'))
    .update(`hafize-session-v1\0${payload}`)
    .digest('base64url');
}

function forgedToken(key, nonce = 'A'.repeat(24)) {
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    sub: subject,
    iat: nowValue,
    exp: nowValue + ttlMs,
    n: nonce
  })).toString('base64url');
  return `${payload}.${sign(key, payload)}`;
}

function auth(options) {
  return createCloudSessionAuth({
    passwordHash,
    signingKey: options.signingKey,
    ...(options.previousSigningKey ? { previousSigningKey: options.previousSigningKey } : {}),
    subject,
    ttlMs,
    now: () => nowValue,
    randomBytesImpl: () => Buffer.alloc(18, options.nonceByte || 9)
  });
}

const oldAuth = auth({ signingKey: key1, nonceByte: 11 });
const oldLogin = await oldAuth.login({ password });
assert.equal(oldLogin.ok, true);
const oldToken = cookieToken(oldLogin.setCookie);
assert.equal(oldAuth.authenticate({ headers: headersFor(oldToken) }).ok, true);

const rotated = auth({ signingKey: key2, previousSigningKey: key1, nonceByte: 12 });
const oldOnRotated = rotated.authenticate({ headers: headersFor(oldToken) });
assert.equal(oldOnRotated.ok, true);
assert.equal(oldOnRotated.principal.subject, subject);
assert.equal(oldOnRotated.signingKeySlot, 'previous');

const newLogin = await rotated.login({ password });
assert.equal(newLogin.ok, true);
const newToken = cookieToken(newLogin.setCookie);
assert.notEqual(newToken, oldToken);
assert.equal(rotated.authenticate({ headers: headersFor(newToken) }).signingKeySlot, 'active');

const newOnly = auth({ signingKey: key2 });
assert.equal(newOnly.authenticate({ headers: headersFor(newToken) }).ok, true);
assert.equal(newOnly.authenticate({ headers: headersFor(oldToken) }).ok, false);

const oldOnly = auth({ signingKey: key1 });
assert.equal(oldOnly.authenticate({ headers: headersFor(oldToken) }).ok, true);
assert.equal(oldOnly.authenticate({ headers: headersFor(newToken) }).ok, false, 'new login must never be signed with previous key');

assert.equal(rotated.authenticate({ headers: headersFor(forgedToken(key3)) }).ok, false);
assert.equal(rotated.authenticate({ headers: headersFor(forgedToken(key1, 'B'.repeat(24))) }).signingKeySlot, 'previous');
assert.equal(rotated.authenticate({ headers: headersFor(forgedToken(key2, 'C'.repeat(24))) }).signingKeySlot, 'active');

assert.throws(
  () => auth({ signingKey: key2, previousSigningKey: key2 }),
  /INVALID_CLOUD_SESSION_AUTH:previousSigningKey\.duplicate/
);
assert.throws(
  () => auth({ signingKey: key2, previousSigningKey: 'not-valid!' }),
  /INVALID_CLOUD_SESSION_AUTH:previousSigningKey/
);
assert.throws(
  () => createCloudSessionAuth({ passwordHash, signingKey: key2, previousSigningKey: key1, subject, ttlMs, now: null }),
  /INVALID_CLOUD_SESSION_AUTH:dependencies/
);

assert.equal(CLOUD_SESSION_LIMITS.maxVerificationSigningKeys, 2);
assert.equal(Object.prototype.hasOwnProperty.call(newLogin, 'signingKeySlot'), false, 'login result must not expose key slot');

console.log('cloud session signing key rotation tests passed');
