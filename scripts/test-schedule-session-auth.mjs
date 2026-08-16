import assert from 'node:assert/strict';
import { createOptionalScheduleSessionAuthenticator, authenticateSchedulePrincipal, SCHEDULE_SESSION_AUTH_ENV } from '../lib/schedule-session-auth.mjs';

const completeEnv = Object.freeze({
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: 'scrypt$16384$8$1$abcdefghijklmnop$abcdefghijklmnopqrstuvwxyzABCDEFGH',
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-abcdef',
  HAFIZE_CLOUD_SESSION_SUBJECT: 'owner@example',
  HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example',
  HAFIZE_CLOUD_SESSION_TTL_MS: '3600000'
});

assert.deepEqual(SCHEDULE_SESSION_AUTH_ENV, {
  passwordHash: 'HAFIZE_CLOUD_SESSION_PASSWORD_HASH',
  signingKey: 'HAFIZE_CLOUD_SESSION_SIGNING_KEY',
  subject: 'HAFIZE_CLOUD_SESSION_SUBJECT',
  origin: 'HAFIZE_CLOUD_SESSION_ORIGIN',
  ttlMs: 'HAFIZE_CLOUD_SESSION_TTL_MS'
});

assert.equal(createOptionalScheduleSessionAuthenticator({ env: {} }), null);

let capturedConfig = null;
const fakeAuth = createOptionalScheduleSessionAuthenticator({
  env: completeEnv,
  createAuth(config) {
    capturedConfig = config;
    return {
      authenticate({ headers }) {
        return headers?.cookie === 'ok'
          ? { ok: true, principal: Object.freeze({ authenticated: true, subject: config.subject }), expiresAt: 123 }
          : { ok: false, error: 'AUTH_REQUIRED' };
      }
    };
  }
});
assert.equal(typeof fakeAuth.authenticate, 'function');
assert.equal(capturedConfig.subject, 'owner@example');
assert.equal(capturedConfig.ttlMs, 3_600_000);
assert.equal(capturedConfig.signingKey, completeEnv.HAFIZE_CLOUD_SESSION_SIGNING_KEY);
assert.equal(capturedConfig.passwordHash, completeEnv.HAFIZE_CLOUD_SESSION_PASSWORD_HASH);
assert.deepEqual(fakeAuth.authenticate({ headers: { cookie: 'ok' } }), {
  ok: true,
  principal: { authenticated: true, subject: 'owner@example' },
  expiresAt: 123
});

const noTtlConfig = { ...completeEnv };
delete noTtlConfig.HAFIZE_CLOUD_SESSION_TTL_MS;
let noTtlCaptured;
createOptionalScheduleSessionAuthenticator({
  env: noTtlConfig,
  createAuth(config) {
    noTtlCaptured = config;
    return { authenticate() { return { ok: false, error: 'AUTH_REQUIRED' }; } };
  }
});
assert.equal(Object.hasOwn(noTtlCaptured, 'ttlMs'), false);

for (const key of [
  'HAFIZE_CLOUD_SESSION_PASSWORD_HASH',
  'HAFIZE_CLOUD_SESSION_SIGNING_KEY',
  'HAFIZE_CLOUD_SESSION_SUBJECT',
  'HAFIZE_CLOUD_SESSION_ORIGIN'
]) {
  const partial = { ...completeEnv, [key]: '' };
  assert.throws(
    () => createOptionalScheduleSessionAuthenticator({ env: partial, createAuth: () => ({ authenticate() {} }) }),
    /INVALID_SCHEDULE_SESSION_AUTH:partialConfig/
  );
}

for (const origin of ['http://hafize.example', 'https://user@hafize.example', 'https://hafize.example/path', 'not-a-url']) {
  assert.throws(
    () => createOptionalScheduleSessionAuthenticator({
      env: { ...completeEnv, HAFIZE_CLOUD_SESSION_ORIGIN: origin },
      createAuth: () => ({ authenticate() {} })
    }),
    /INVALID_SCHEDULE_SESSION_AUTH:HAFIZE_CLOUD_SESSION_ORIGIN/
  );
}

for (const ttl of ['59999', '43200001', '-1', '1.5', 'abc']) {
  assert.throws(
    () => createOptionalScheduleSessionAuthenticator({
      env: { ...completeEnv, HAFIZE_CLOUD_SESSION_TTL_MS: ttl },
      createAuth: () => ({ authenticate() {} })
    }),
    /INVALID_SCHEDULE_SESSION_AUTH:HAFIZE_CLOUD_SESSION_TTL_MS/
  );
}

let calls = [];
const bearer = {
  authenticate({ headers }) {
    calls.push(['bearer', headers]);
    return headers?.authorization === 'Bearer good'
      ? { ok: true, principal: Object.freeze({ authenticated: true, subject: 'api-owner' }) }
      : { ok: false, error: 'AUTH_REQUIRED' };
  }
};
const session = {
  authenticate({ headers }) {
    calls.push(['session', headers]);
    return headers?.cookie === 'session=good'
      ? { ok: true, principal: Object.freeze({ authenticated: true, subject: 'web-owner' }) }
      : { ok: false, error: 'AUTH_REQUIRED' };
  }
};

calls = [];
let result = authenticateSchedulePrincipal({
  primaryAuthenticator: bearer,
  sessionAuthenticator: session,
  headers: { authorization: 'Bearer good', cookie: 'session=good' }
});
assert.equal(result.ok, true);
assert.equal(result.principal.subject, 'api-owner');
assert.deepEqual(calls.map(([name]) => name), ['bearer'], 'valid bearer must short-circuit session fallback');

calls = [];
result = authenticateSchedulePrincipal({
  primaryAuthenticator: bearer,
  sessionAuthenticator: session,
  headers: { cookie: 'session=good' }
});
assert.equal(result.ok, true);
assert.equal(result.principal.subject, 'web-owner');
assert.deepEqual(calls.map(([name]) => name), ['bearer', 'session']);

calls = [];
result = authenticateSchedulePrincipal({ primaryAuthenticator: bearer, sessionAuthenticator: session, headers: {} });
assert.deepEqual(result, { ok: false, error: 'AUTH_REQUIRED' });
assert.deepEqual(calls.map(([name]) => name), ['bearer', 'session']);

const throwing = { authenticate() { throw new Error('secret backend detail'); } };
result = authenticateSchedulePrincipal({ primaryAuthenticator: throwing, sessionAuthenticator: session, headers: {} });
assert.deepEqual(result, { ok: false, error: 'AUTH_REQUIRED' });
result = authenticateSchedulePrincipal({ primaryAuthenticator: bearer, sessionAuthenticator: throwing, headers: {} });
assert.deepEqual(result, { ok: false, error: 'AUTH_REQUIRED' });

assert.throws(() => authenticateSchedulePrincipal({}), /INVALID_SCHEDULE_SESSION_AUTH:primaryAuthenticator/);
assert.throws(
  () => authenticateSchedulePrincipal({ primaryAuthenticator: bearer, sessionAuthenticator: {} }),
  /INVALID_SCHEDULE_SESSION_AUTH:sessionAuthenticator/
);
assert.throws(() => createOptionalScheduleSessionAuthenticator({ env: [] }), /INVALID_SCHEDULE_SESSION_AUTH:env/);
assert.throws(() => createOptionalScheduleSessionAuthenticator({ env: {}, createAuth: null }), /INVALID_SCHEDULE_SESSION_AUTH:createAuth/);

console.log('schedule session auth tests passed');
