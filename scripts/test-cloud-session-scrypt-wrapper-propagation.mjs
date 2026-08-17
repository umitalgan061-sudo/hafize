import assert from 'node:assert/strict';
import { createRevocableCloudSessionAuth } from '../lib/cloud-session-revocable-auth.mjs';
import { createPrivilegedPrincipalAuthenticator } from '../lib/privileged-principal-auth.mjs';

const SALT = Buffer.alloc(16, 4).toString('base64url');
const DIGEST = Buffer.alloc(32, 6).toString('base64url');
const KEY = Buffer.alloc(32, 8).toString('base64url');
const SUBJECT = 'wrapper-user';

function hash(N, r, p) {
  return `scrypt$${N}$${r}$${p}$${SALT}$${DIGEST}`;
}

const safeConfig = {
  passwordHash: hash(16_384, 8, 1),
  signingKey: KEY,
  subject: SUBJECT,
  now: () => 1_900_000_000_000
};
assert.doesNotThrow(() => createRevocableCloudSessionAuth(safeConfig));

for (const unsafeHash of [
  hash(262_144, 8, 1),
  hash(131_072, 16, 1),
  hash(131_072, 8, 5)
]) {
  assert.throws(
    () => createRevocableCloudSessionAuth({ ...safeConfig, passwordHash: unsafeHash }),
    (error) => error?.code === 'INVALID_CLOUD_SESSION_AUTH:passwordHash.cost'
  );
}

// Privileged browser-cookie fallback is built from the same revocable auth primitive;
// unsafe password cost must therefore remain impossible to configure through that path.
const baseEnv = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: safeConfig.passwordHash,
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: KEY,
  HAFIZE_CLOUD_SESSION_SUBJECT: SUBJECT,
  HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example'
};
assert.doesNotThrow(() => createPrivilegedPrincipalAuthenticator({ env: baseEnv }));
assert.throws(
  () => createPrivilegedPrincipalAuthenticator({
    env: { ...baseEnv, HAFIZE_CLOUD_SESSION_PASSWORD_HASH: hash(262_144, 8, 1) }
  }),
  (error) => error?.code === 'INVALID_CLOUD_SESSION_AUTH:passwordHash.cost'
);

// No wrapper is allowed to silently downgrade an unsafe cloud cookie config into bearer-only mode.
assert.throws(
  () => createPrivilegedPrincipalAuthenticator({
    env: { ...baseEnv, HAFIZE_CLOUD_SESSION_PASSWORD_HASH: hash(131_072, 8, 5) }
  }),
  (error) => error?.code === 'INVALID_CLOUD_SESSION_AUTH:passwordHash.cost'
);

console.log('cloud session scrypt wrapper propagation: ok');
