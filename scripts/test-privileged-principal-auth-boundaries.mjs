import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createPrivilegedPrincipalAuthenticator } from '../lib/privileged-principal-auth.mjs';

function b64(bytes, fill) {
  return Buffer.alloc(bytes, fill).toString('base64url');
}

const TOKEN = 't'.repeat(48);
const SUBJECT = 'service:privileged';
const CLOUD_SUBJECT = 'user:browser';

function config(overrides = {}) {
  return {
    HAFIZE_PRIV_AUTH_TOKEN: TOKEN,
    HAFIZE_PRIV_AUTH_SUBJECT: SUBJECT,
    HAFIZE_CLOUD_SESSION_PASSWORD_HASH: `scrypt$16384$8$1$${b64(16, 7)}$${b64(32, 8)}`,
    HAFIZE_CLOUD_SESSION_SIGNING_KEY: b64(32, 9),
    HAFIZE_CLOUD_SESSION_SUBJECT: CLOUD_SUBJECT,
    HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example',
    HAFIZE_CLOUD_SESSION_TTL_MS: '14400000',
    ...overrides
  };
}

function create(env = config(), extra = {}) {
  return createPrivilegedPrincipalAuthenticator({
    env,
    tokenEnv: 'HAFIZE_PRIV_AUTH_TOKEN',
    subjectEnv: 'HAFIZE_PRIV_AUTH_SUBJECT',
    ...extra
  });
}

function cookie(env, {
  issuedAt = Date.now() - 1_000,
  expiresAt = issuedAt + 14_400_000,
  subject = CLOUD_SUBJECT,
  nonce = 'z'.repeat(24),
  signingKey = env.HAFIZE_CLOUD_SESSION_SIGNING_KEY
} = {}) {
  const payload = Buffer.from(JSON.stringify({ v: 1, sub: subject, iat: issuedAt, exp: expiresAt, n: nonce })).toString('base64url');
  const key = Buffer.from(signingKey, 'base64url');
  const signature = createHmac('sha256', key).update(`hafize-session-v1\0${payload}`).digest('base64url');
  return `__Host-hafize_session=${payload}.${signature}`;
}

{
  const env = config();
  const auth = create(env);
  const valid = cookie(env);
  const duplicate = `${valid}; ${valid}`;
  assert.deepEqual(auth.authenticate({ headers: { cookie: duplicate } }), { ok: false, error: 'AUTH_REQUIRED' });
}

{
  const env = config();
  const auth = create(env);
  const wrongKeyCookie = cookie(env, { signingKey: b64(32, 10) });
  assert.deepEqual(auth.authenticate({ headers: { cookie: wrongKeyCookie } }), { ok: false, error: 'AUTH_REQUIRED' });
}

{
  const env = config();
  const auth = create(env);
  const future = Date.now() + 60_000;
  const futureCookie = cookie(env, { issuedAt: future, expiresAt: future + 14_400_000 });
  assert.deepEqual(auth.authenticate({ headers: { cookie: futureCookie } }), { ok: false, error: 'AUTH_REQUIRED' });
}

{
  const env = config();
  const auth = create(env);
  const now = Date.now();
  const wrongTtlCookie = cookie(env, { issuedAt: now - 1_000, expiresAt: now - 1_000 + 120_000 });
  assert.deepEqual(auth.authenticate({ headers: { cookie: wrongTtlCookie } }), { ok: false, error: 'AUTH_REQUIRED' });
}

{
  const env = config();
  const auth = create(env);
  assert.deepEqual(auth.authenticate({ headers: { authorization: 'Basic abc' } }), { ok: false, error: 'AUTH_REQUIRED' });
  assert.deepEqual(auth.authenticate({ headers: { authorization: 'Bearer short' } }), { ok: false, error: 'AUTH_REQUIRED' });
}

{
  const env = config({ HAFIZE_CLOUD_SESSION_PASSWORD_HASH: '' });
  const auth = create(env, { allowCloudSession: false });
  assert.deepEqual(auth.modes, { bearer: true, cloudSession: false });
  assert.equal(auth.authenticate({ headers: { authorization: `Bearer ${TOKEN}` } }).ok, true);
}

for (const [field, value] of [
  ['HAFIZE_PRIV_AUTH_TOKEN', `${TOKEN}\nattack`],
  ['HAFIZE_PRIV_AUTH_SUBJECT', 'subject\rattack'],
  ['HAFIZE_CLOUD_SESSION_SUBJECT', 'user\nattack'],
  ['HAFIZE_CLOUD_SESSION_ORIGIN', 'https://hafize.example\rattack']
]) {
  assert.throws(() => create(config({ [field]: value })), /INVALID_PRIVILEGED_PRINCIPAL_AUTH/);
}

assert.throws(
  () => create(config({ HAFIZE_PRIV_AUTH_TOKEN: '', HAFIZE_PRIV_AUTH_SUBJECT: SUBJECT })),
  /INVALID_PRIVILEGED_PRINCIPAL_AUTH:bearerConfig/
);
assert.throws(
  () => create(config({ HAFIZE_PRIV_AUTH_TOKEN: TOKEN, HAFIZE_PRIV_AUTH_SUBJECT: '' })),
  /INVALID_PRIVILEGED_PRINCIPAL_AUTH:bearerConfig/
);

{
  const onlyCloud = config({ HAFIZE_PRIV_AUTH_TOKEN: '', HAFIZE_PRIV_AUTH_SUBJECT: '' });
  const auth = create(onlyCloud);
  assert.deepEqual(auth.modes, { bearer: false, cloudSession: true });
  assert.equal(auth.authenticate({ headers: { cookie: cookie(onlyCloud) } }).principal.subject, CLOUD_SUBJECT);
}

{
  const auth = create(config());
  const publicShape = JSON.stringify(auth.modes);
  assert.equal(publicShape.includes(TOKEN), false);
  assert.equal(publicShape.includes('PASSWORD_HASH'), false);
  assert.equal(publicShape.includes('SIGNING_KEY'), false);
  assert.deepEqual(Object.keys(auth).sort(), ['authenticate', 'modes']);
  assert.equal(Object.isFrozen(auth), true);
  assert.equal(Object.isFrozen(auth.modes), true);
}

console.log('privileged principal auth boundary tests passed');
