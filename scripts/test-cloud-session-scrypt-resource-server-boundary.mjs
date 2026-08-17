import assert from 'node:assert/strict';
import { createCloudSessionNodeServerRuntime } from '../lib/cloud-session-node-server-runtime.mjs';

const SALT = Buffer.alloc(16, 3).toString('base64url');
const DIGEST = Buffer.alloc(32, 5).toString('base64url');
const SIGNING_KEY = Buffer.alloc(32, 7).toString('base64url');

function envFor(passwordHash) {
  return {
    HAFIZE_CLOUD_SESSION_PASSWORD_HASH: passwordHash,
    HAFIZE_CLOUD_SESSION_SIGNING_KEY: SIGNING_KEY,
    HAFIZE_CLOUD_SESSION_SUBJECT: 'server-boundary-user',
    HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example'
  };
}

function hash(N, r, p) {
  return `scrypt$${N}$${r}$${p}$${SALT}$${DIGEST}`;
}

function expectStartupFailure(passwordHash, code) {
  assert.throws(
    () => createCloudSessionNodeServerRuntime({ env: envFor(passwordHash) }),
    (error) => error?.code === code,
    `expected startup failure ${code}`
  );
}

// A conventional interactive scrypt profile remains a valid configured runtime.
const configured = createCloudSessionNodeServerRuntime({
  env: envFor(hash(16_384, 8, 1)),
  now: () => 1_700_000_000_000
});
assert.equal(configured.configured, true);
assert.equal(typeof configured.handle, 'function');
assert.equal(typeof configured.authenticator?.authenticate, 'function');

// Individually valid scalar values cannot request an unsafe combined memory budget.
expectStartupFailure(hash(1_048_576, 8, 1), 'INVALID_CLOUD_SESSION_AUTH:passwordHash.cost');
expectStartupFailure(hash(262_144, 8, 1), 'INVALID_CLOUD_SESSION_AUTH:passwordHash.cost');
expectStartupFailure(hash(131_072, 16, 1), 'INVALID_CLOUD_SESSION_AUTH:passwordHash.cost');

// A profile below the memory ceiling can still be rejected on total work units.
expectStartupFailure(hash(131_072, 8, 5), 'INVALID_CLOUD_SESSION_AUTH:passwordHash.cost');

// Exact work-boundary profiles are accepted without starting any password derivation.
for (const profile of [
  [65_536, 8, 8],
  [131_072, 8, 4]
]) {
  const runtime = createCloudSessionNodeServerRuntime({
    env: envFor(hash(...profile)),
    now: () => 1_700_000_000_000
  });
  assert.equal(runtime.configured, true);
}

// Partial config still fails through its original dedicated boundary.
assert.throws(
  () => createCloudSessionNodeServerRuntime({
    env: { HAFIZE_CLOUD_SESSION_PASSWORD_HASH: hash(16_384, 8, 1) }
  }),
  (error) => error?.code === 'INVALID_CLOUD_SESSION_SERVER:partialConfig'
);

// An entirely absent cloud-session configuration remains safely disabled.
const disabled = createCloudSessionNodeServerRuntime({ env: {} });
assert.equal(disabled.configured, false);
assert.equal(disabled.authenticator, null);

console.log('cloud session scrypt server startup boundary: ok');
