import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import {
  authenticateSchedulePrincipal,
  createOptionalScheduleSessionAuthenticator
} from '../lib/schedule-session-auth.mjs';
import { createRevocableCloudSessionAuth } from '../lib/cloud-session-revocable-auth.mjs';

const password = 'schedule origin test password';
const salt = Buffer.alloc(16, 71);
const digest = scryptSync(password, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const signingKey = Buffer.alloc(32, 72).toString('base64url');
const origin = 'https://hafize.example';
const subject = 'user:schedule-origin';
const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}`,
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: signingKey,
  HAFIZE_CLOUD_SESSION_SUBJECT: subject,
  HAFIZE_CLOUD_SESSION_ORIGIN: origin,
  HAFIZE_CLOUD_SESSION_TTL_MS: '120000'
};

const issuer = createRevocableCloudSessionAuth({
  passwordHash: env.HAFIZE_CLOUD_SESSION_PASSWORD_HASH,
  signingKey,
  subject,
  ttlMs: 120_000
});
const login = await issuer.login(password);
const cookie = login.setCookie.split(';', 1)[0];
const sessionAuthenticator = createOptionalScheduleSessionAuthenticator({ env });
assert.equal(sessionAuthenticator.allowedOrigin, origin);

const deniedPrimary = {
  authenticate() { return { ok: false, error: 'AUTH_REQUIRED' }; }
};
const bearerPrimary = {
  authenticate() {
    return { ok: true, principal: { authenticated: true, subject: 'service:scheduler' } };
  }
};

// Read-only schedule listing may use an authenticated cookie without a mutation Origin gate.
const read = authenticateSchedulePrincipal({
  primaryAuthenticator: deniedPrimary,
  sessionAuthenticator,
  headers: { cookie },
  requireSessionOrigin: false
});
assert.equal(read.ok, true);
assert.equal(read.principal.subject, subject);

// Mutations using cookie fallback require the exact configured HTTPS Origin.
assert.deepEqual(
  authenticateSchedulePrincipal({
    primaryAuthenticator: deniedPrimary,
    sessionAuthenticator,
    headers: { cookie },
    requireSessionOrigin: true
  }),
  { ok: false, error: 'AUTH_REQUIRED' }
);
assert.deepEqual(
  authenticateSchedulePrincipal({
    primaryAuthenticator: deniedPrimary,
    sessionAuthenticator,
    headers: { cookie, origin: 'https://evil.example' },
    requireSessionOrigin: true
  }),
  { ok: false, error: 'AUTH_REQUIRED' }
);
const mutation = authenticateSchedulePrincipal({
  primaryAuthenticator: deniedPrimary,
  sessionAuthenticator,
  headers: { cookie, origin },
  requireSessionOrigin: true
});
assert.equal(mutation.ok, true);
assert.equal(mutation.principal.subject, subject);

// Bearer/service auth remains origin-independent, even when a foreign Origin is present.
const service = authenticateSchedulePrincipal({
  primaryAuthenticator: bearerPrimary,
  sessionAuthenticator,
  headers: { origin: 'https://evil.example' },
  requireSessionOrigin: true
});
assert.equal(service.ok, true);
assert.equal(service.principal.subject, 'service:scheduler');

// Revocation performed by another auth instance is visible through schedule fallback.
assert.equal(issuer.revoke({ headers: { cookie } }).ok, true);
assert.deepEqual(
  authenticateSchedulePrincipal({
    primaryAuthenticator: deniedPrimary,
    sessionAuthenticator,
    headers: { cookie, origin },
    requireSessionOrigin: true
  }),
  { ok: false, error: 'AUTH_REQUIRED' }
);
const secondScheduleAuth = createOptionalScheduleSessionAuthenticator({ env });
assert.deepEqual(
  authenticateSchedulePrincipal({
    primaryAuthenticator: deniedPrimary,
    sessionAuthenticator: secondScheduleAuth,
    headers: { cookie, origin },
    requireSessionOrigin: true
  }),
  { ok: false, error: 'AUTH_REQUIRED' }
);

// Configuration remains fail-closed for unsafe origins and partial cloud credentials.
assert.throws(
  () => createOptionalScheduleSessionAuthenticator({ env: { ...env, HAFIZE_CLOUD_SESSION_ORIGIN: 'http://hafize.example' } }),
  /INVALID_SCHEDULE_SESSION_AUTH/
);
assert.throws(
  () => createOptionalScheduleSessionAuthenticator({ env: { HAFIZE_CLOUD_SESSION_ORIGIN: origin } }),
  /INVALID_SCHEDULE_SESSION_AUTH:partialConfig/
);

console.log('schedule cloud session origin/revocation tests passed');
