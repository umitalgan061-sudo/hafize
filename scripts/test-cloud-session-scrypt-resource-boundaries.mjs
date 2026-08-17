import assert from 'node:assert/strict';
import { createCloudSessionAuth } from '../lib/cloud-session-auth.mjs';

const SALT = Buffer.alloc(16, 1).toString('base64url');
const DIGEST = Buffer.alloc(32, 2).toString('base64url');
const KEY = Buffer.alloc(32, 3).toString('base64url');

function makeHash(N, r, p) {
  return `scrypt$${N}$${r}$${p}$${SALT}$${DIGEST}`;
}

function makeAuth(N, r, p) {
  return createCloudSessionAuth({
    passwordHash: makeHash(N, r, p),
    signingKey: KEY,
    subject: 'boundary-user'
  });
}

function accepted(N, r, p) {
  assert.doesNotThrow(() => makeAuth(N, r, p), `profile ${N}/${r}/${p} should be accepted`);
}

function rejectedCost(N, r, p) {
  assert.throws(
    () => makeAuth(N, r, p),
    (error) => error?.code === 'INVALID_CLOUD_SESSION_AUTH:passwordHash.cost',
    `profile ${N}/${r}/${p} should fail combined resource policy`
  );
}

// Work threshold: 4,194,304 units is inclusive; the next representable profile is rejected.
accepted(65_536, 8, 8);
accepted(131_072, 8, 4);
rejectedCost(131_072, 8, 5);
rejectedCost(131_072, 8, 8);

// Memory threshold includes an explicit 1 MiB safety overhead for node:crypto maxmem.
// 131072/8 is ~128 MiB plus overhead and remains valid.
accepted(131_072, 8, 1);
accepted(131_072, 8, 4);
// 262144/8 reaches 256 MiB before overhead, therefore must fail rather than sit on the edge.
rejectedCost(262_144, 8, 1);

// Increasing r consumes both memory and work budgets.
accepted(65_536, 16, 1);
rejectedCost(65_536, 32, 1);
rejectedCost(131_072, 16, 1);

// Increasing p consumes work but not the memory estimate, so the CPU guard is independently useful.
accepted(65_536, 8, 4);
accepted(65_536, 8, 8);
rejectedCost(131_072, 8, 5);

// Lowest supported scalar profile remains accepted.
accepted(16_384, 8, 1);

// The scalar maximums are not implicit permission to allocate them together.
rejectedCost(1_048_576, 32, 8);

// Whitespace or alternate numeric encodings are not silently normalized inside the hash format.
for (const value of [
  `scrypt$ 16384$8$1$${SALT}$${DIGEST}`,
  `scrypt$16384 $8$1$${SALT}$${DIGEST}`,
  `scrypt$16384$08x$1$${SALT}$${DIGEST}`,
  `scrypt$16384$8$1.0$${SALT}$${DIGEST}`
]) {
  assert.throws(
    () => createCloudSessionAuth({ passwordHash: value, signingKey: KEY, subject: 'boundary-user' }),
    (error) => error?.code === 'INVALID_CLOUD_SESSION_AUTH:passwordHash'
  );
}

console.log('cloud session scrypt threshold boundaries: ok');
