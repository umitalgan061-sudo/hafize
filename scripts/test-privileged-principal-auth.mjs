import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  createPrivilegedPrincipalAuthenticator,
  PRIVILEGED_PRINCIPAL_AUTH_LIMITS
} from '../lib/privileged-principal-auth.mjs';

const TOKEN = 'b'.repeat(48);
const BEARER_SUBJECT = 'service:github-write';
const CLOUD_SUBJECT = 'user:hafize-web';
const ORIGIN = 'https://hafize.example';
const NOW = Date.now();

function b64(bytes, fill) {
  return Buffer.alloc(bytes, fill).toString('base64url');
}

function baseEnv() {
  return {
    HAFIZE_GITHUB_WRITE_AUTH_TOKEN: TOKEN,
    HAFIZE_GITHUB_WRITE_AUTH_SUBJECT: BEARER_SUBJECT
  };
}

function cloudEnv(overrides = {}) {
  return {
    ...baseEnv(),
    HAFIZE_CLOUD_SESSION_PASSWORD_HASH: `scrypt$16384$8$1$${b64(16, 1)}$${b64(32, 2)}`,
    HAFIZE_CLOUD_SESSION_SIGNING_KEY: b64(32, 3),
    HAFIZE_CLOUD_SESSION_SUBJECT: CLOUD_SUBJECT,
    HAFIZE_CLOUD_SESSION_ORIGIN: ORIGIN,
    HAFIZE_CLOUD_SESSION_TTL_MS: '14400000',
    ...overrides
  };
}

function cloudCookie(env, { now = NOW, subject = CLOUD_SUBJECT, ttlMs = 14_400_000, nonce = 'n'.repeat(24) } = {}) {
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    sub: subject,
    iat: now - 1_000,
    exp: now - 1_000 + ttlMs,
    n: nonce
  })).toString('base64url');
  const key = Buffer.from(env.HAFIZE_CLOUD_SESSION_SIGNING_KEY, 'base64url');
  const signature = createHmac('sha256', key).update(`hafize-session-v1\0${payload}`).digest('base64url');
  return `__Host-hafize_session=${payload}.${signature}`;
}

function create(env, options = {}) {
  return createPrivilegedPrincipalAuthenticator({
    env,
    tokenEnv: 'HAFIZE_GITHUB_WRITE_AUTH_TOKEN',
    subjectEnv: 'HAFIZE_GITHUB_WRITE_AUTH_SUBJECT',
    ...options
  });
}

assert.equal(PRIVILEGED_PRINCIPAL_AUTH_LIMITS.defaultTtlMs, 14_400_000);
assert.equal(PRIVILEGED_PRINCIPAL_AUTH_LIMITS.minTtlMs, 60_000);
assert.equal(PRIVILEGED_PRINCIPAL_AUTH_LIMITS.maxTtlMs, 43_200_000);

{
  const auth = create(baseEnv());
  assert.deepEqual(auth.modes, { bearer: true, cloudSession: false });
  assert.deepEqual(auth.authenticate({ headers: { authorization: `Bearer ${TOKEN}` } }), {
    ok: true,
    principal: { authenticated: true, subject: BEARER_SUBJECT }
  });
  assert.deepEqual(auth.authenticate({ headers: {} }), { ok: false, error: 'AUTH_REQUIRED' });
}

{
  const env = cloudEnv();
  const auth = create(env);
  assert.deepEqual(auth.modes, { bearer: true, cloudSession: true });
  assert.deepEqual(auth.authenticate({ headers: { cookie: cloudCookie(env) } }), { ok: false, error: 'AUTH_REQUIRED' });
  assert.deepEqual(auth.authenticate({ headers: { cookie: cloudCookie(env), origin: 'https://evil.example' } }), { ok: false, error: 'AUTH_REQUIRED' });
  const result = auth.authenticate({ headers: { cookie: cloudCookie(env), origin: ORIGIN } });
  assert.equal(result.ok, true);
  assert.equal(result.principal.subject, CLOUD_SUBJECT);
  assert.equal(result.principal.authenticated, true);
}

{
  const env = cloudEnv();
  const auth = create(env);
  const result = auth.authenticate({
    headers: {
      authorization: `Bearer ${TOKEN}`,
      cookie: cloudCookie(env),
      origin: 'https://evil.example'
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.principal.subject, BEARER_SUBJECT, 'valid bearer must keep precedence over browser session');
}

{
  const env = cloudEnv();
  const auth = create(env);
  const result = auth.authenticate({
    headers: {
      authorization: `Bearer ${'x'.repeat(48)}`,
      cookie: cloudCookie(env),
      origin: ORIGIN
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.principal.subject, CLOUD_SUBJECT, 'invalid bearer may fall back to valid exact-origin cloud session');
}

{
  const env = cloudEnv();
  const auth = create(env);
  const malformed = '__Host-hafize_session=not.a.valid.session';
  assert.deepEqual(auth.authenticate({ headers: { cookie: malformed, origin: ORIGIN } }), { ok: false, error: 'AUTH_REQUIRED' });
}

{
  const env = cloudEnv();
  const auth = create(env);
  const expiredCookie = cloudCookie(env, { now: NOW - 20_000_000 });
  assert.deepEqual(auth.authenticate({ headers: { cookie: expiredCookie, origin: ORIGIN } }), { ok: false, error: 'AUTH_REQUIRED' });
}

{
  const env = cloudEnv();
  const auth = create(env);
  const wrongSubject = cloudCookie(env, { subject: 'user:someone-else' });
  assert.deepEqual(auth.authenticate({ headers: { cookie: wrongSubject, origin: ORIGIN } }), { ok: false, error: 'AUTH_REQUIRED' });
}

{
  const env = cloudEnv();
  const auth = create(env, { allowCloudSession: false });
  assert.deepEqual(auth.modes, { bearer: true, cloudSession: false });
  assert.deepEqual(auth.authenticate({ headers: { cookie: cloudCookie(env), origin: ORIGIN } }), { ok: false, error: 'AUTH_REQUIRED' });
  assert.equal(auth.authenticate({ headers: { authorization: `Bearer ${TOKEN}` } }).ok, true);
}

{
  const env = cloudEnv({ HAFIZE_CLOUD_SESSION_TTL_MS: '60000' });
  const auth = create(env);
  assert.equal(auth.modes.cloudSession, true);
}

for (const invalidTtl of ['59999', '43200001', '1.5', 'not-a-number']) {
  assert.throws(
    () => create(cloudEnv({ HAFIZE_CLOUD_SESSION_TTL_MS: invalidTtl })),
    /INVALID_PRIVILEGED_PRINCIPAL_AUTH:cloudTtl/
  );
}

for (const missing of [
  'HAFIZE_CLOUD_SESSION_PASSWORD_HASH',
  'HAFIZE_CLOUD_SESSION_SIGNING_KEY',
  'HAFIZE_CLOUD_SESSION_SUBJECT',
  'HAFIZE_CLOUD_SESSION_ORIGIN'
]) {
  const env = cloudEnv({ [missing]: '' });
  assert.throws(() => create(env), /INVALID_PRIVILEGED_PRINCIPAL_AUTH:cloudConfig/);
}

for (const unsafeOrigin of ['http://hafize.example', 'https://user@hafize.example', 'https://hafize.example/path', 'https://hafize.example?x=1']) {
  assert.throws(
    () => create(cloudEnv({ HAFIZE_CLOUD_SESSION_ORIGIN: unsafeOrigin })),
    /INVALID_PRIVILEGED_PRINCIPAL_AUTH:cloudOrigin/
  );
}

assert.throws(
  () => createPrivilegedPrincipalAuthenticator({ env: {}, tokenEnv: 'bad-name', subjectEnv: 'GOOD_ENV' }),
  /INVALID_PRIVILEGED_PRINCIPAL_AUTH:tokenEnv/
);
assert.throws(
  () => createPrivilegedPrincipalAuthenticator({ env: {}, tokenEnv: 'GOOD_ENV', subjectEnv: 'bad-name' }),
  /INVALID_PRIVILEGED_PRINCIPAL_AUTH:subjectEnv/
);
assert.equal(createPrivilegedPrincipalAuthenticator({
  env: {},
  tokenEnv: 'HAFIZE_GITHUB_WRITE_AUTH_TOKEN',
  subjectEnv: 'HAFIZE_GITHUB_WRITE_AUTH_SUBJECT'
}), null);

console.log('privileged principal auth tests passed');
