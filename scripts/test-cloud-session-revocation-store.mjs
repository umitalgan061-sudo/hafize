import assert from 'node:assert/strict';
import {
  CLOUD_SESSION_REVOCATION_LIMITS,
  createCloudSessionRevocationStore,
  fingerprintCloudSessionToken,
  readCloudSessionToken
} from '../lib/cloud-session-revocable-auth.mjs';

const signingKey = Buffer.alloc(32, 7).toString('base64url');
let now = 1_700_000_000_000;
const clock = () => now;

function fingerprint(index) {
  return fingerprintCloudSessionToken(signingKey, `payload-${index}.signature-${index}`);
}

{
  const first = fingerprint(1);
  const second = fingerprint(2);
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
  assert.equal(first, fingerprint(1));
  assert.throws(() => fingerprintCloudSessionToken(signingKey, ''), /INVALID_CLOUD_SESSION_REVOCATION:token/);
  assert.throws(() => fingerprintCloudSessionToken('short', 'token'), /INVALID_CLOUD_SESSION_REVOCATION:signingKey/);
}

{
  const token = 'header.payload_signature';
  assert.equal(readCloudSessionToken({ cookie: `theme=dark; __Host-hafize_session=${token}; locale=tr` }), token);
  assert.equal(readCloudSessionToken({ Cookie: `__Host-hafize_session=${token}` }), token);
  assert.equal(readCloudSessionToken({ cookie: `__Host-hafize_session=${token}; __Host-hafize_session=other` }), null);
  assert.equal(readCloudSessionToken({ cookie: '__Host-hafize_session=bad token' }), null);
  assert.equal(readCloudSessionToken({ cookie: '__Host-hafize_session=' }), null);
  assert.equal(readCloudSessionToken({}), null);
  assert.equal(readCloudSessionToken({ cookie: `x=${'a'.repeat(CLOUD_SESSION_REVOCATION_LIMITS.maxCookieBytes + 1)}` }), null);
}

{
  const store = createCloudSessionRevocationStore({ maxEntries: 16, now: clock });
  const fp = fingerprint(3);
  assert.equal(store.size(), 0);
  assert.deepEqual(store.revoke({ fingerprint: fp, expiresAt: now + 60_000 }), { ok: true });
  assert.equal(store.size(), 1);
  assert.equal(store.isRevoked(fp), true);

  // Re-revoking the same fingerprint is idempotent and does not consume capacity.
  assert.deepEqual(store.revoke({ fingerprint: fp, expiresAt: now + 120_000 }), { ok: true });
  assert.equal(store.size(), 1);
  assert.equal(store.isRevoked(fp), true);

  now += 120_000;
  assert.equal(store.isRevoked(fp), false);
  assert.equal(store.size(), 0);
}

{
  now = 1_700_000_500_000;
  const store = createCloudSessionRevocationStore({ maxEntries: 16, now: clock });
  for (let index = 0; index < 16; index += 1) {
    assert.deepEqual(store.revoke({ fingerprint: fingerprint(index + 10), expiresAt: now + 60_000 }), { ok: true });
  }
  assert.equal(store.size(), 16);
  assert.deepEqual(
    store.revoke({ fingerprint: fingerprint(99), expiresAt: now + 60_000 }),
    { ok: false, error: 'SESSION_REVOCATION_UNAVAILABLE' }
  );
  assert.equal(store.size(), 16);

  now += 60_000;
  assert.equal(store.prune(), 16);
  assert.equal(store.size(), 0);
  assert.deepEqual(store.revoke({ fingerprint: fingerprint(99), expiresAt: now + 60_000 }), { ok: true });
}

{
  now = 1_700_001_000_000;
  const store = createCloudSessionRevocationStore({ maxEntries: 16, now: clock });
  assert.deepEqual(
    store.revoke({ fingerprint: fingerprint(120), expiresAt: now }),
    { ok: false, error: 'AUTH_REQUIRED' }
  );
  assert.equal(store.size(), 0);
  assert.equal(store.isRevoked('not-a-fingerprint'), false);
  assert.throws(() => store.revoke({ fingerprint: 'bad', expiresAt: now + 1 }), /INVALID_CLOUD_SESSION_REVOCATION:fingerprint/);
  assert.throws(() => store.revoke({ fingerprint: fingerprint(121), expiresAt: NaN }), /INVALID_CLOUD_SESSION_REVOCATION:expiresAt/);
}

{
  assert.throws(() => createCloudSessionRevocationStore({ maxEntries: 15 }), /INVALID_CLOUD_SESSION_REVOCATION:maxEntries/);
  assert.throws(() => createCloudSessionRevocationStore({ maxEntries: 100_001 }), /INVALID_CLOUD_SESSION_REVOCATION:maxEntries/);
  const invalidClock = createCloudSessionRevocationStore({ maxEntries: 16, now: () => NaN });
  assert.throws(
    () => invalidClock.revoke({ fingerprint: fingerprint(130), expiresAt: 1_700_001_060_000 }),
    /INVALID_CLOUD_SESSION_REVOCATION:now/
  );
}

console.log('cloud session revocation store tests passed');
