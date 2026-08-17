import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import {
  createCloudSessionRevocationStore,
  createRevocableCloudSessionAuth
} from '../lib/cloud-session-revocable-auth.mjs';

const password = 'rotation-revocation-password';
const salt = Buffer.alloc(16, 4);
const digest = scryptSync(password, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const passwordHash = `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}`;
const active1 = Buffer.alloc(32, 21).toString('base64url');
const active2 = Buffer.alloc(32, 22).toString('base64url');
const subject = 'revocation-user';
const start = 1_800_000_100_000;
let clock = start;
const ttlMs = 120_000;
const store = createCloudSessionRevocationStore({ maxEntries: 32, now: () => clock });

function tokenFromCookie(setCookie) {
  return setCookie.split(';', 1)[0].split('=', 2)[1];
}
function headers(token) {
  return { cookie: `__Host-hafize_session=${token}` };
}
function build({ signingKey, previousSigningKey, nonceByte }) {
  return createRevocableCloudSessionAuth({
    passwordHash,
    signingKey,
    ...(previousSigningKey ? { previousSigningKey } : {}),
    subject,
    ttlMs,
    now: () => clock,
    randomBytesImpl: () => Buffer.alloc(18, nonceByte),
    revocationStore: store
  });
}

const beforeRotation = build({ signingKey: active1, nonceByte: 31 });
const login = await beforeRotation.login({ password });
assert.equal(login.ok, true);
const oldToken = tokenFromCookie(login.setCookie);
assert.equal(beforeRotation.authenticate({ headers: headers(oldToken) }).ok, true);

const revoked = beforeRotation.revoke({ headers: headers(oldToken) });
assert.equal(revoked.ok, true);
assert.equal(store.size(), 1);
assert.equal(beforeRotation.authenticate({ headers: headers(oldToken) }).ok, false);

const rotated = build({ signingKey: active2, previousSigningKey: active1, nonceByte: 32 });
assert.equal(
  rotated.authenticate({ headers: headers(oldToken) }).ok,
  false,
  'old-key revocation must remain effective while previous key is configured'
);

const secondOldLogin = await build({ signingKey: active1, nonceByte: 33 }).login({ password });
const secondOldToken = tokenFromCookie(secondOldLogin.setCookie);
const oldDuringOverlap = rotated.authenticate({ headers: headers(secondOldToken) });
assert.equal(oldDuringOverlap.ok, true);
assert.deepEqual(Object.keys(oldDuringOverlap).sort(), ['expiresAt', 'ok', 'principal']);
assert.equal(Object.prototype.hasOwnProperty.call(oldDuringOverlap, 'fingerprint'), false);
assert.equal(Object.prototype.hasOwnProperty.call(oldDuringOverlap, 'signingKeySlot'), false);

assert.equal(rotated.revoke({ headers: headers(secondOldToken) }).ok, true);
assert.equal(rotated.authenticate({ headers: headers(secondOldToken) }).ok, false);

const afterOverlap = build({ signingKey: active2, nonceByte: 34 });
assert.equal(afterOverlap.authenticate({ headers: headers(secondOldToken) }).ok, false);
const newLogin = await afterOverlap.login({ password });
const newToken = tokenFromCookie(newLogin.setCookie);
assert.equal(afterOverlap.authenticate({ headers: headers(newToken) }).ok, true);
assert.equal(rotated.authenticate({ headers: headers(newToken) }).ok, true);

clock += ttlMs + 1;
store.prune();
assert.equal(store.size(), 0, 'expired revocation fingerprints must be pruned');
assert.equal(afterOverlap.authenticate({ headers: headers(newToken) }).ok, false, 'expired session remains invalid after prune');

console.log('cloud session rotation revocation tests passed');
