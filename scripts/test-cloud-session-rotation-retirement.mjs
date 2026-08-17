import assert from 'node:assert/strict';
import { createHmac, scryptSync } from 'node:crypto';
import { createCloudSessionAuth } from '../lib/cloud-session-auth.mjs';

const password = 'rotation-retirement-password';
const salt = Buffer.alloc(16, 71);
const digest = scryptSync(password, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const passwordHash = `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}`;
const oldKey = Buffer.alloc(32, 72).toString('base64url');
const newKey = Buffer.alloc(32, 73).toString('base64url');
const subject = 'rotation-retirement-user';
const issuedAt = 1_800_000_500_000;
const ttlMs = 60_000;
let clock = issuedAt;

function sign(key, payload) {
  return createHmac('sha256', Buffer.from(key, 'base64url'))
    .update(`hafize-session-v1\0${payload}`)
    .digest('base64url');
}

function oldToken() {
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    sub: subject,
    iat: issuedAt,
    exp: issuedAt + ttlMs,
    n: 'R'.repeat(24)
  })).toString('base64url');
  return `${payload}.${sign(oldKey, payload)}`;
}

function build(previousSigningKey) {
  return createCloudSessionAuth({
    passwordHash,
    signingKey: newKey,
    ...(previousSigningKey ? { previousSigningKey } : {}),
    subject,
    ttlMs,
    now: () => clock
  });
}

const token = oldToken();
const headers = { cookie: `__Host-hafize_session=${token}` };
const overlap = build(oldKey);
assert.equal(overlap.authenticate({ headers }).ok, true);

clock = issuedAt + ttlMs - 1;
assert.equal(overlap.authenticate({ headers }).ok, true, 'overlap never shortens an otherwise valid old session');

clock = issuedAt + ttlMs;
assert.equal(overlap.authenticate({ headers }).ok, false, 'previous key must not extend session TTL');

clock = issuedAt + 1;
const retired = build();
assert.equal(retired.authenticate({ headers }).ok, false, 'removing previous key retires old sessions immediately');

clock = issuedAt - 1;
assert.equal(overlap.authenticate({ headers }).ok, false, 'future-issued old session remains rejected');

console.log('cloud session rotation retirement tests passed');
