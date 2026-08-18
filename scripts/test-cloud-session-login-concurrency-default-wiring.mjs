import assert from 'node:assert/strict';
import {
  createCloudSessionNodeServerRuntime,
  CLOUD_SESSION_SERVER_LIMITS
} from '../lib/cloud-session-node-server-runtime.mjs';

const captured = [];
const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: 'stub-hash',
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: 'stub-key',
  HAFIZE_CLOUD_SESSION_SUBJECT: 'owner-1',
  HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example'
};
const fakeAuth = Object.freeze({
  async login() { return { ok: false, error: 'AUTH_REQUIRED' }; },
  authenticate() { return { ok: false, error: 'AUTH_REQUIRED' }; },
  revoke() { return { ok: false, error: 'AUTH_REQUIRED' }; },
  logoutCookie() { return 'clear'; }
});

const runtime = createCloudSessionNodeServerRuntime({
  env,
  createAuth: () => fakeAuth,
  createVerificationGate(options) {
    captured.push(options);
    return Object.freeze({ begin: () => Object.freeze({ ok: true, complete: () => true }) });
  },
  createHttpApi(options) {
    assert.equal(typeof options.loginGate, 'function');
    assert.equal(typeof options.verificationGate, 'function');
    return Object.freeze({ handle: async () => Object.freeze({ matched: true, status: 204, body: {}, headers: {} }) });
  }
});
assert.equal(runtime.configured, true);
assert.deepEqual(captured, [{ maxConcurrent: 2 }]);
assert.equal(CLOUD_SESSION_SERVER_LIMITS.defaultLoginConcurrency, 2);
assert.equal(CLOUD_SESSION_SERVER_LIMITS.maxLoginConcurrency, 16);

captured.length = 0;
createCloudSessionNodeServerRuntime({
  env,
  loginConcurrency: 16,
  createAuth: () => fakeAuth,
  createVerificationGate(options) {
    captured.push(options);
    return Object.freeze({ begin() { return { ok: true, complete() {} }; } });
  },
  createHttpApi: () => Object.freeze({ handle() {} })
});
assert.deepEqual(captured, [{ maxConcurrent: 16 }]);

let badFactoryCalled = false;
assert.throws(
  () => createCloudSessionNodeServerRuntime({
    env,
    createAuth: () => fakeAuth,
    createVerificationGate() {
      badFactoryCalled = true;
      return Object.freeze({});
    }
  }),
  /INVALID_CLOUD_SESSION_SERVER:verificationGate/
);
assert.equal(badFactoryCalled, true);

assert.throws(
  () => createCloudSessionNodeServerRuntime({ env, createAuth: () => fakeAuth, createVerificationGate: null }),
  /INVALID_CLOUD_SESSION_SERVER:dependencies/
);

const disabled = createCloudSessionNodeServerRuntime({
  env: {},
  createVerificationGate() { throw new Error('disabled runtime must not create verification gate'); }
});
assert.equal(disabled.configured, false);

process.stdout.write('cloud session login concurrency default wiring tests passed\n');
