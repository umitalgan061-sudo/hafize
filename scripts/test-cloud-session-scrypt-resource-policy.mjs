import assert from 'node:assert/strict';
import { createCloudSessionAuth, CLOUD_SESSION_LIMITS } from '../lib/cloud-session-auth.mjs';

const SALT = Buffer.alloc(16, 7).toString('base64url');
const DIGEST = Buffer.alloc(32, 9).toString('base64url');
const SIGNING_KEY = Buffer.alloc(32, 11).toString('base64url');
const SUBJECT = 'scrypt-policy-test';

function hash(N, r, p) {
  return `scrypt$${N}$${r}$${p}$${SALT}$${DIGEST}`;
}

function create(passwordHash) {
  return createCloudSessionAuth({
    passwordHash,
    signingKey: SIGNING_KEY,
    subject: SUBJECT,
    now: () => 1_000_000,
    randomBytesImpl: () => Buffer.alloc(18, 4)
  });
}

function expectInvalidCost(N, r, p) {
  assert.throws(
    () => create(hash(N, r, p)),
    (error) => error?.code === 'INVALID_CLOUD_SESSION_AUTH:passwordHash.cost',
    `expected ${N}/${r}/${p} to be rejected by combined cost policy`
  );
}

function expectAcceptedCost(N, r, p) {
  assert.doesNotThrow(
    () => create(hash(N, r, p)),
    `expected ${N}/${r}/${p} to be accepted by combined cost policy`
  );
}

assert.equal(CLOUD_SESSION_LIMITS.maxScryptMemoryBytes, 256 * 1024 * 1024);
assert.equal(CLOUD_SESSION_LIMITS.maxScryptWorkUnits, 4 * 1024 * 1024);
assert.equal(CLOUD_SESSION_LIMITS.scryptMemoryOverheadBytes, 1024 * 1024);

// Common interactive-login profiles remain valid.
expectAcceptedCost(16_384, 8, 1);
expectAcceptedCost(32_768, 8, 1);
expectAcceptedCost(65_536, 8, 1);
expectAcceptedCost(131_072, 8, 1);

// Parallelization is allowed only while the separate work budget remains bounded.
expectAcceptedCost(65_536, 8, 8); // exactly 4,194,304 work units
expectAcceptedCost(131_072, 8, 4); // exactly 4,194,304 work units
expectInvalidCost(131_072, 8, 5);

// Individually legal N/r values must not be able to request multi-gigabyte maxmem.
expectInvalidCost(1_048_576, 8, 1);
expectInvalidCost(524_288, 8, 1);
expectInvalidCost(262_144, 8, 1);
expectInvalidCost(131_072, 16, 1);
expectInvalidCost(65_536, 32, 1);

// Scalar schema guards remain distinct from combined resource guards.
assert.throws(
  () => create(hash(131_072, 8, 9)),
  (error) => error?.code === 'INVALID_CLOUD_SESSION_AUTH:passwordHash.p'
);
assert.throws(
  () => create(hash(24_576, 8, 1)),
  (error) => error?.code === 'INVALID_CLOUD_SESSION_AUTH:passwordHash.N'
);
for (const [N, r, p, code] of [
  [8192, 8, 1, 'INVALID_CLOUD_SESSION_AUTH:passwordHash.N'],
  [16_384, 7, 1, 'INVALID_CLOUD_SESSION_AUTH:passwordHash.r'],
  [16_384, 8, 0, 'INVALID_CLOUD_SESSION_AUTH:passwordHash.p']
]) {
  assert.throws(() => create(hash(N, r, p)), (error) => error?.code === code);
}

// Malformed hashes fail before any crypto work is attempted.
for (const malformed of [
  '',
  'scrypt$16384$8$1',
  `scrypt$16384$8$1$bad salt$${DIGEST}`,
  `scrypt$16384$8$1$${SALT}$not/base64`,
  `argon2$16384$8$1$${SALT}$${DIGEST}`
]) {
  assert.throws(
    () => create(malformed),
    (error) => typeof error?.code === 'string' && error.code.startsWith('INVALID_CLOUD_SESSION_AUTH:')
  );
}

console.log('cloud session scrypt resource policy: ok');
