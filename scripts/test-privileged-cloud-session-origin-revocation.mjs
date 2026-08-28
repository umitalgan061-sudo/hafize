import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { createPrivilegedPrincipalAuthenticator } from '../lib/privileged-principal-auth.mjs';
import { createRevocableCloudSessionAuth } from '../lib/cloud-session-revocable-auth.mjs';

const password = 'privileged origin test password';
const salt = Buffer.alloc(16, 61);
const digest = scryptSync(password, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const signingKey = Buffer.alloc(32, 62).toString('base64url');
const origin = 'https://hafize.example';
const subject = 'user:privileged-origin';
const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}`,
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: signingKey,
  HAFIZE_CLOUD_SESSION_SUBJECT: subject,
  HAFIZE_CLOUD_SESSION_ORIGIN: origin,
  HAFIZE_CLOUD_SESSION_TTL_MS: '120000',
  HAFIZE_GITHUB_WRITE_AUTH_TOKEN: 'server-bearer-token',
  HAFIZE_GITHUB_WRITE_AUTH_SUBJECT: 'service:github-write'
};

const sessionIssuer = createRevocableCloudSessionAuth({
  passwordHash: env.HAFIZE_CLOUD_SESSION_PASSWORD_HASH,
  signingKey,
  subject,
  ttlMs: 120_000
});
const login = await sessionIssuer.login({ password });
assert.equal(login.ok, true);
const cookie = login.setCookie.split(';', 1)[0];

const auth = createPrivilegedPrincipalAuthenticator({
  env,
  tokenEnv: 'HAFIZE_GITHUB_WRITE_AUTH_TOKEN',
  subjectEnv: 'HAFIZE_GITHUB_WRITE_AUTH_SUBJECT',
  allowCloudSession: true
});
assert.equal(auth.modes.bearer, true);
assert.equal(auth.modes.cloudSession, true);

// Server-to-server bearer remains origin-independent and takes precedence over a bad cookie.
const bearer = auth.authenticate({ headers: { authorization: 'Bearer server-bearer-token' } });
assert.equal(bearer.ok, true);
assert.equal(bearer.principal.subject, 'service:github-write');
const bearerWithForeignOrigin = auth.authenticate({
  headers: {
    authorization: 'Bearer server-bearer-token',
    origin: 'https://evil.example',
    cookie
  }
});
assert.equal(bearerWithForeignOrigin.ok, true);
assert.equal(bearerWithForeignOrigin.principal.subject, 'service:github-write');

// Cookie fallback is browser authority, so exact configured Origin is mandatory.
assert.deepEqual(auth.authenticate({ headers: { cookie } }), { ok: false, error: 'AUTH_REQUIRED' });
assert.deepEqual(
  auth.authenticate({ headers: { cookie, origin: 'https://evil.example' } }),
  { ok: false, error: 'AUTH_REQUIRED' }
);
assert.deepEqual(
  auth.authenticate({ headers: { cookie, origin: `${origin}/path` } }),
  { ok: false, error: 'AUTH_REQUIRED' }
);
const cloud = auth.authenticate({ headers: { cookie, origin } });
assert.equal(cloud.ok, true);
assert.equal(cloud.principal.subject, subject);

// Header casing is accepted, but the value still has to be an exact origin.
const upper = auth.authenticate({ headers: { Cookie: cookie, Origin: origin } });
assert.equal(upper.ok, true);
assert.equal(upper.principal.subject, subject);

// Logout/revoke in one auth instance is visible to independently-created privileged auth.
const revoked = sessionIssuer.revoke({ headers: { cookie } });
assert.equal(revoked.ok, true);
assert.deepEqual(
  auth.authenticate({ headers: { cookie, origin } }),
  { ok: false, error: 'AUTH_REQUIRED' }
);
const secondPrivileged = createPrivilegedPrincipalAuthenticator({
  env,
  tokenEnv: 'HAFIZE_GITHUB_WRITE_AUTH_TOKEN',
  subjectEnv: 'HAFIZE_GITHUB_WRITE_AUTH_SUBJECT'
});
assert.deepEqual(
  secondPrivileged.authenticate({ headers: { cookie, origin } }),
  { ok: false, error: 'AUTH_REQUIRED' }
);

// A fresh session nonce is not collateral-damaged by the old fingerprint.
const freshLogin = await sessionIssuer.login({ password });
const freshCookie = freshLogin.setCookie.split(';', 1)[0];
assert.notEqual(freshCookie, cookie);
const fresh = secondPrivileged.authenticate({ headers: { cookie: freshCookie, origin } });
assert.equal(fresh.ok, true);
assert.equal(fresh.principal.subject, subject);

console.log('privileged cloud session origin/revocation tests passed');
