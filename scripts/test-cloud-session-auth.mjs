import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { createCloudSessionAuth, CLOUD_SESSION_COOKIE_NAME } from '../lib/cloud-session-auth.mjs';

const PASSWORD = 'correct horse battery staple';
const SALT = Buffer.alloc(16, 7);
const N = 16_384;
const R = 8;
const P = 1;
const DIGEST = scryptSync(PASSWORD, SALT, 32, { N, r: R, p: P, maxmem: 32 * 1024 * 1024 });
const PASSWORD_HASH = `scrypt$${N}$${R}$${P}$${SALT.toString('base64url')}$${DIGEST.toString('base64url')}`;
const SIGNING_KEY = Buffer.alloc(32, 9).toString('base64url');
const SUBJECT = 'user@example.test';

function makeAuth(overrides = {}) {
  let clock = 1_700_000_000_000;
  const auth = createCloudSessionAuth({
    passwordHash: PASSWORD_HASH,
    signingKey: SIGNING_KEY,
    subject: SUBJECT,
    ttlMs: 60 * 60 * 1000,
    now: () => clock,
    randomBytesImpl: () => Buffer.alloc(18, 4),
    ...overrides
  });
  return { auth, setTime(value) { clock = value; } };
}

function cookieHeader(setCookie) {
  return setCookie.split(';', 1)[0];
}

{
  const { auth } = makeAuth();
  const login = await auth.login({ password: PASSWORD });
  assert.equal(login.ok, true);
  assert.equal(login.expiresAt, 1_700_003_600_000);
  assert.match(login.setCookie, new RegExp(`^${CLOUD_SESSION_COOKIE_NAME}=`));
  assert.match(login.setCookie, /; Path=\//);
  assert.match(login.setCookie, /; HttpOnly/);
  assert.match(login.setCookie, /; Secure/);
  assert.match(login.setCookie, /; SameSite=Strict$/);
  assert.equal(login.setCookie.includes(PASSWORD), false);
  assert.equal(login.setCookie.includes(PASSWORD_HASH), false);
  assert.equal(login.setCookie.includes(SIGNING_KEY), false);

  const authenticated = auth.authenticate({ headers: { cookie: cookieHeader(login.setCookie) } });
  assert.equal(authenticated.ok, true);
  assert.deepEqual(authenticated.principal, { authenticated: true, subject: SUBJECT });
  assert.equal(authenticated.expiresAt, login.expiresAt);
}

{
  const { auth } = makeAuth();
  assert.deepEqual(await auth.login({ password: 'wrong password value' }), { ok: false, error: 'AUTH_REQUIRED' });
  assert.deepEqual(await auth.login({ password: 'short' }), { ok: false, error: 'AUTH_REQUIRED' });
  assert.deepEqual(auth.authenticate({ headers: {} }), { ok: false, error: 'AUTH_REQUIRED' });
}

{
  const { auth } = makeAuth();
  const login = await auth.login({ password: PASSWORD });
  const original = cookieHeader(login.setCookie);
  const token = original.slice(CLOUD_SESSION_COOKIE_NAME.length + 1);
  const [payload, signature] = token.split('.');
  const tamperedPayload = `${payload.slice(0, -1)}${payload.endsWith('A') ? 'B' : 'A'}`;
  assert.equal(auth.authenticate({ headers: { cookie: `${CLOUD_SESSION_COOKIE_NAME}=${tamperedPayload}.${signature}` } }).ok, false);
  const tamperedSignature = `${signature.slice(0, -1)}${signature.endsWith('A') ? 'B' : 'A'}`;
  assert.equal(auth.authenticate({ headers: { cookie: `${CLOUD_SESSION_COOKIE_NAME}=${payload}.${tamperedSignature}` } }).ok, false);
}

{
  const { auth, setTime } = makeAuth();
  const login = await auth.login({ password: PASSWORD });
  const header = cookieHeader(login.setCookie);
  setTime(login.expiresAt - 1);
  assert.equal(auth.authenticate({ headers: { cookie: header } }).ok, true);
  setTime(login.expiresAt);
  assert.deepEqual(auth.authenticate({ headers: { cookie: header } }), { ok: false, error: 'AUTH_REQUIRED' });
}

{
  const { auth } = makeAuth();
  const login = await auth.login({ password: PASSWORD });
  const cookie = cookieHeader(login.setCookie);
  assert.equal(auth.authenticate({ headers: { cookie: `${cookie}; ${cookie}` } }).ok, false, 'duplicate session cookie must fail closed');
  assert.equal(auth.authenticate({ headers: { cookie: `other=x; ${cookie}; another=y` } }).ok, true);
  assert.equal(auth.authenticate({ headers: { cookie: 'x'.repeat(5000) } }).ok, false);
}

{
  const { auth } = makeAuth();
  const login = await auth.login({ password: PASSWORD });
  const rawToken = cookieHeader(login.setCookie).split('=')[1];
  const payload = JSON.parse(Buffer.from(rawToken.split('.')[0], 'base64url').toString('utf8'));
  assert.deepEqual(Object.keys(payload).sort(), ['exp', 'iat', 'n', 'sub', 'v']);
  assert.equal(payload.sub, SUBJECT);
  assert.equal(JSON.stringify(payload).includes('password'), false);
  assert.equal(JSON.stringify(payload).includes('token'), false);
  assert.equal(JSON.stringify(payload).includes('secret'), false);
}

{
  const { auth } = makeAuth();
  assert.equal(auth.logoutCookie(), `${CLOUD_SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`);
}

for (const invalid of [
  undefined,
  'plaintext-password',
  `scrypt$1000$8$1$${SALT.toString('base64url')}$${DIGEST.toString('base64url')}`,
  `scrypt$16385$8$1$${SALT.toString('base64url')}$${DIGEST.toString('base64url')}`,
  `scrypt$16384$8$1$bad!$${DIGEST.toString('base64url')}`
]) {
  assert.throws(() => createCloudSessionAuth({ passwordHash: invalid, signingKey: SIGNING_KEY, subject: SUBJECT }), /INVALID_CLOUD_SESSION_AUTH/);
}

assert.throws(() => createCloudSessionAuth({ passwordHash: PASSWORD_HASH, signingKey: 'too-short', subject: SUBJECT }), /INVALID_CLOUD_SESSION_AUTH/);
assert.throws(() => createCloudSessionAuth({ passwordHash: PASSWORD_HASH, signingKey: SIGNING_KEY, subject: '' }), /INVALID_CLOUD_SESSION_AUTH/);
assert.throws(() => createCloudSessionAuth({ passwordHash: PASSWORD_HASH, signingKey: SIGNING_KEY, subject: SUBJECT, ttlMs: 13 * 60 * 60 * 1000 }), /INVALID_CLOUD_SESSION_AUTH/);

console.log('cloud session auth security tests passed');
