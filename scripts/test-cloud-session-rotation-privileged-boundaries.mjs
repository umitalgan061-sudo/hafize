import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { createCloudSessionAuth } from '../lib/cloud-session-auth.mjs';
import { createPrivilegedPrincipalAuthenticator } from '../lib/privileged-principal-auth.mjs';
import {
  authenticateSchedulePrincipal,
  createOptionalScheduleSessionAuthenticator,
  SCHEDULE_SESSION_AUTH_ENV
} from '../lib/schedule-session-auth.mjs';

const password = 'privileged-rotation-password';
const salt = Buffer.alloc(16, 51);
const digest = scryptSync(password, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const passwordHash = `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}`;
const oldKey = Buffer.alloc(32, 52).toString('base64url');
const newKey = Buffer.alloc(32, 53).toString('base64url');
const subject = 'privileged-rotation-user';
const origin = 'https://hafize.example';
const now = 1_800_000_300_000;
const ttlMs = 60_000;

function tokenFrom(setCookie) {
  return setCookie.split(';', 1)[0].slice('__Host-hafize_session='.length);
}
function cookieHeaders(token, requestOrigin = origin) {
  return { cookie: `__Host-hafize_session=${token}`, origin: requestOrigin };
}

const oldAuth = createCloudSessionAuth({
  passwordHash,
  signingKey: oldKey,
  subject,
  ttlMs,
  now: () => now,
  randomBytesImpl: () => Buffer.alloc(18, 54)
});
const oldToken = tokenFrom((await oldAuth.login({ password })).setCookie);

const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: passwordHash,
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: newKey,
  HAFIZE_CLOUD_SESSION_PREVIOUS_SIGNING_KEY: oldKey,
  HAFIZE_CLOUD_SESSION_SUBJECT: subject,
  HAFIZE_CLOUD_SESSION_ORIGIN: origin,
  HAFIZE_CLOUD_SESSION_TTL_MS: String(ttlMs),
  TEST_WRITE_TOKEN: 'server-bearer-token-rotation-test',
  TEST_WRITE_SUBJECT: 'server-writer'
};

const privileged = createPrivilegedPrincipalAuthenticator({
  env,
  tokenEnv: 'TEST_WRITE_TOKEN',
  subjectEnv: 'TEST_WRITE_SUBJECT'
});
assert.equal(privileged.modes.bearer, true);
assert.equal(privileged.modes.cloudSession, true);
assert.equal(privileged.authenticate({ headers: cookieHeaders(oldToken) }).ok, true, 'old cookie works during overlap');
assert.equal(privileged.authenticate({ headers: cookieHeaders(oldToken, 'https://evil.example') }).ok, false, 'cloud fallback remains exact-origin bound');
assert.equal(privileged.authenticate({ headers: { cookie: `__Host-hafize_session=${oldToken}` } }).ok, false, 'missing Origin remains fail-closed');

const bearer = privileged.authenticate({ headers: { authorization: 'Bearer server-bearer-token-rotation-test' } });
assert.equal(bearer.ok, true);
assert.equal(bearer.principal.subject, 'server-writer', 'bearer remains primary and does not require browser Origin');

const noPreviousEnv = { ...env };
delete noPreviousEnv.HAFIZE_CLOUD_SESSION_PREVIOUS_SIGNING_KEY;
const afterOverlap = createPrivilegedPrincipalAuthenticator({
  env: noPreviousEnv,
  tokenEnv: 'TEST_WRITE_TOKEN',
  subjectEnv: 'TEST_WRITE_SUBJECT'
});
assert.equal(afterOverlap.authenticate({ headers: cookieHeaders(oldToken) }).ok, false, 'old cookie expires from trust when previous key is removed');

const schedule = createOptionalScheduleSessionAuthenticator({ env });
assert.equal(schedule.allowedOrigin, origin);
const primaryReject = Object.freeze({ authenticate: () => Object.freeze({ ok: false, error: 'AUTH_REQUIRED' }) });
assert.equal(authenticateSchedulePrincipal({
  primaryAuthenticator: primaryReject,
  sessionAuthenticator: schedule,
  headers: cookieHeaders(oldToken),
  requireSessionOrigin: true
}).ok, true);
assert.equal(authenticateSchedulePrincipal({
  primaryAuthenticator: primaryReject,
  sessionAuthenticator: schedule,
  headers: cookieHeaders(oldToken, 'https://evil.example'),
  requireSessionOrigin: true
}).ok, false);

const primaryAccept = Object.freeze({
  authenticate: () => Object.freeze({ ok: true, principal: Object.freeze({ authenticated: true, subject: 'schedule-bearer' }) })
});
const primaryResult = authenticateSchedulePrincipal({
  primaryAuthenticator: primaryAccept,
  sessionAuthenticator: schedule,
  headers: {},
  requireSessionOrigin: true
});
assert.equal(primaryResult.ok, true);
assert.equal(primaryResult.principal.subject, 'schedule-bearer');

assert.equal(SCHEDULE_SESSION_AUTH_ENV.previousSigningKey, 'HAFIZE_CLOUD_SESSION_PREVIOUS_SIGNING_KEY');
assert.throws(
  () => createOptionalScheduleSessionAuthenticator({ env: { HAFIZE_CLOUD_SESSION_PREVIOUS_SIGNING_KEY: oldKey } }),
  /INVALID_SCHEDULE_SESSION_AUTH:partialConfig/
);

console.log('cloud session rotated privileged boundary tests passed');
