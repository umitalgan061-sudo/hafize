import assert from 'node:assert/strict';
import {
  createCloudSessionNodeServerRuntime,
  CLOUD_SESSION_SERVER_ENV
} from '../lib/cloud-session-node-server-runtime.mjs';

const active = Buffer.alloc(32, 41).toString('base64url');
const previous = Buffer.alloc(32, 42).toString('base64url');
const baseEnv = Object.freeze({
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: 'scrypt$16384$8$1$QUFBQUFBQUFBQUFBQUFBQQ$QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUE',
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: active,
  HAFIZE_CLOUD_SESSION_PREVIOUS_SIGNING_KEY: previous,
  HAFIZE_CLOUD_SESSION_SUBJECT: 'rotation-config-user',
  HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example',
  HAFIZE_CLOUD_SESSION_TTL_MS: '60000'
});

let capturedAuthOptions = null;
let capturedApiOptions = null;
const fakeAuth = Object.freeze({
  login: async () => ({ ok: false, error: 'AUTH_REQUIRED' }),
  authenticate: () => ({ ok: false, error: 'AUTH_REQUIRED' }),
  revoke: () => ({ ok: false, error: 'AUTH_REQUIRED' }),
  logoutCookie: () => '__Host-hafize_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'
});

const runtime = createCloudSessionNodeServerRuntime({
  env: baseEnv,
  now: () => 1_800_000_200_000,
  createAuth(options) {
    capturedAuthOptions = options;
    return fakeAuth;
  },
  createHttpApi(options) {
    capturedApiOptions = options;
    return Object.freeze({ handle: async () => Object.freeze({ matched: true, status: 200, body: Object.freeze({ ok: true }) }) });
  }
});

assert.equal(runtime.configured, true);
assert.equal(runtime.authenticator, fakeAuth);
assert.equal(capturedAuthOptions.signingKey, active);
assert.equal(capturedAuthOptions.previousSigningKey, previous);
assert.equal(capturedAuthOptions.subject, 'rotation-config-user');
assert.equal(capturedAuthOptions.ttlMs, 60000);
assert.equal(typeof capturedAuthOptions.now, 'function');
assert.equal(capturedApiOptions.allowedOrigin, 'https://hafize.example');
assert.equal(Object.prototype.hasOwnProperty.call(runtime, 'previousSigningKey'), false);
assert.equal(Object.prototype.hasOwnProperty.call(runtime, 'signingKey'), false);

assert.equal(CLOUD_SESSION_SERVER_ENV.previousSigningKey, 'HAFIZE_CLOUD_SESSION_PREVIOUS_SIGNING_KEY');
assert.equal(Object.values(CLOUD_SESSION_SERVER_ENV).includes(previous), false, 'env contract may expose only names, never secret values');

const noPrevious = { ...baseEnv };
delete noPrevious.HAFIZE_CLOUD_SESSION_PREVIOUS_SIGNING_KEY;
let withoutPrevious = null;
createCloudSessionNodeServerRuntime({
  env: noPrevious,
  createAuth(options) {
    withoutPrevious = options;
    return fakeAuth;
  },
  createHttpApi: () => ({ handle: async () => ({ matched: false }) })
});
assert.equal(Object.prototype.hasOwnProperty.call(withoutPrevious, 'previousSigningKey'), false, 'rotation remains opt-in');

assert.throws(
  () => createCloudSessionNodeServerRuntime({
    env: { HAFIZE_CLOUD_SESSION_PREVIOUS_SIGNING_KEY: previous },
    createAuth: () => fakeAuth,
    createHttpApi: () => ({ handle: async () => ({ matched: false }) })
  }),
  /INVALID_CLOUD_SESSION_SERVER:partialConfig/
);

assert.throws(
  () => createCloudSessionNodeServerRuntime({
    env: { ...baseEnv, HAFIZE_CLOUD_SESSION_PREVIOUS_SIGNING_KEY: `${previous}\nunsafe` },
    createAuth: () => fakeAuth,
    createHttpApi: () => ({ handle: async () => ({ matched: false }) })
  }),
  /INVALID_CLOUD_SESSION_SERVER:HAFIZE_CLOUD_SESSION_PREVIOUS_SIGNING_KEY/
);

const disabled = createCloudSessionNodeServerRuntime({
  env: {},
  createAuth: () => { throw new Error('must not construct auth'); },
  createHttpApi: () => { throw new Error('must not construct API'); }
});
assert.equal(disabled.configured, false);
assert.equal(disabled.authenticator, null);

console.log('cloud session rotation server config tests passed');
