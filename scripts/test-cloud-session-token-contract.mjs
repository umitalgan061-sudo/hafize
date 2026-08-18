import assert from 'node:assert/strict';
import {
  CLOUD_SESSION_TOKEN_CONTRACT,
  decodeCloudSessionPayload,
  encodeCloudSessionPayload,
  readCloudSessionCookieToken,
  splitCloudSessionToken
} from '../lib/cloud-session-token-contract.mjs';

const SUBJECT = 'owner:hafize';
const ISSUED_AT = 1_800_000_000_000;
const EXPIRES_AT = ISSUED_AT + 60_000;
const NONCE = 'abcdefghijklmnopqrstuvwx';

function encodeRaw(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

const encoded = encodeCloudSessionPayload({
  subject: SUBJECT,
  issuedAt: ISSUED_AT,
  expiresAt: EXPIRES_AT,
  nonce: NONCE
});
const payload = decodeCloudSessionPayload(encoded, { subject: SUBJECT });
assert.deepEqual(payload, {
  v: 1,
  sub: SUBJECT,
  iat: ISSUED_AT,
  exp: EXPIRES_AT,
  n: NONCE
});
assert.equal(Object.isFrozen(payload), true);
assert.equal(decodeCloudSessionPayload(encoded, { subject: 'owner:other' }), null);

const signature = 'A'.repeat(43);
const token = `${encoded}.${signature}`;
assert.deepEqual(splitCloudSessionToken(token), { encodedPayload: encoded, signature });
assert.equal(Object.isFrozen(splitCloudSessionToken(token)), true);

assert.equal(readCloudSessionCookieToken({ cookie: `theme=dark; ${CLOUD_SESSION_TOKEN_CONTRACT.cookieName}=${token}` }), token);
assert.equal(readCloudSessionCookieToken({ Cookie: `${CLOUD_SESSION_TOKEN_CONTRACT.cookieName}=${token}` }), token);
assert.equal(readCloudSessionCookieToken({ cookie: `${CLOUD_SESSION_TOKEN_CONTRACT.cookieName}=${token}; ${CLOUD_SESSION_TOKEN_CONTRACT.cookieName}=${token}` }), null);
assert.equal(readCloudSessionCookieToken({ cookie: `${CLOUD_SESSION_TOKEN_CONTRACT.cookieName}=${token}; x=y; ${CLOUD_SESSION_TOKEN_CONTRACT.cookieName}=other` }), null);
assert.equal(readCloudSessionCookieToken({ cookie: `${CLOUD_SESSION_TOKEN_CONTRACT.cookieName}=${token} bad` }), null);
assert.equal(readCloudSessionCookieToken({ cookie: 'x'.repeat(CLOUD_SESSION_TOKEN_CONTRACT.maxCookieHeaderBytes + 1) }), null);

for (const invalid of [
  '',
  encoded,
  `${encoded}.short`,
  `${encoded}.${signature}.extra`,
  `${encoded}!.${signature}`,
  `${encoded}.${'A'.repeat(42)}`,
  `${encoded}.${'A'.repeat(44)}`,
  `${'A'.repeat(CLOUD_SESSION_TOKEN_CONTRACT.maxEncodedPayloadBytes + 1)}.${signature}`,
  `${'A'.repeat(CLOUD_SESSION_TOKEN_CONTRACT.maxTokenBytes + 1)}.${signature}`
]) {
  assert.equal(splitCloudSessionToken(invalid), null, `token must fail closed: ${invalid.slice(0, 40)}`);
}

const extraField = encodeRaw(JSON.stringify({
  v: 1,
  sub: SUBJECT,
  iat: ISSUED_AT,
  exp: EXPIRES_AT,
  n: NONCE,
  role: 'admin'
}));
assert.equal(decodeCloudSessionPayload(extraField, { subject: SUBJECT }), null);

const reordered = encodeRaw(JSON.stringify({
  sub: SUBJECT,
  v: 1,
  iat: ISSUED_AT,
  exp: EXPIRES_AT,
  n: NONCE
}));
assert.equal(decodeCloudSessionPayload(reordered, { subject: SUBJECT }), null);

const prettyPrinted = encodeRaw(JSON.stringify({
  v: 1,
  sub: SUBJECT,
  iat: ISSUED_AT,
  exp: EXPIRES_AT,
  n: NONCE
}, null, 2));
assert.equal(decodeCloudSessionPayload(prettyPrinted, { subject: SUBJECT }), null);

for (const badNonce of ['', 'short', 'a'.repeat(23), 'a'.repeat(25), 'bad nonce value.........', '!!!!!!!!!!!!!!!!!!!!!!!!']) {
  const candidate = encodeRaw(JSON.stringify({ v: 1, sub: SUBJECT, iat: ISSUED_AT, exp: EXPIRES_AT, n: badNonce }));
  assert.equal(decodeCloudSessionPayload(candidate, { subject: SUBJECT }), null);
}

for (const badPayload of [
  null,
  [],
  { v: 2, sub: SUBJECT, iat: ISSUED_AT, exp: EXPIRES_AT, n: NONCE },
  { v: 1, sub: SUBJECT, iat: -1, exp: EXPIRES_AT, n: NONCE },
  { v: 1, sub: SUBJECT, iat: ISSUED_AT, exp: -1, n: NONCE },
  { v: 1, sub: SUBJECT, iat: 1.5, exp: EXPIRES_AT, n: NONCE },
  { v: 1, sub: SUBJECT, iat: ISSUED_AT, exp: 1.5, n: NONCE }
]) {
  const candidate = encodeRaw(JSON.stringify(badPayload));
  assert.equal(decodeCloudSessionPayload(candidate, { subject: SUBJECT }), null);
}

assert.throws(
  () => encodeCloudSessionPayload({ subject: SUBJECT, issuedAt: ISSUED_AT, expiresAt: EXPIRES_AT, nonce: 'short' }),
  /INVALID_CLOUD_SESSION_TOKEN:nonce/
);
assert.throws(
  () => encodeCloudSessionPayload({ subject: '', issuedAt: ISSUED_AT, expiresAt: EXPIRES_AT, nonce: NONCE }),
  /INVALID_CLOUD_SESSION_TOKEN:subject/
);
assert.throws(
  () => encodeCloudSessionPayload({ subject: SUBJECT, issuedAt: -1, expiresAt: EXPIRES_AT, nonce: NONCE }),
  /INVALID_CLOUD_SESSION_TOKEN:issuedAt/
);

assert.equal(CLOUD_SESSION_TOKEN_CONTRACT.cookieName, '__Host-hafize_session');
assert.equal(CLOUD_SESSION_TOKEN_CONTRACT.version, 1);
assert.equal(CLOUD_SESSION_TOKEN_CONTRACT.maxCookieHeaderBytes, 4096);
assert.equal(CLOUD_SESSION_TOKEN_CONTRACT.maxTokenBytes, 2048);
assert.equal(CLOUD_SESSION_TOKEN_CONTRACT.maxEncodedPayloadBytes, 1024);
assert.equal(CLOUD_SESSION_TOKEN_CONTRACT.nonceLength, 24);
assert.deepEqual(CLOUD_SESSION_TOKEN_CONTRACT.payloadKeys, ['v', 'sub', 'iat', 'exp', 'n']);

console.log('cloud session token contract tests passed');
