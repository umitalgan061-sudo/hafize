import assert from 'node:assert/strict';
import { createCloudSessionNodeServerRuntime } from '../lib/cloud-session-node-server-runtime.mjs';

const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: 'test-hash',
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: '0123456789abcdef0123456789abcdef',
  HAFIZE_CLOUD_SESSION_SUBJECT: 'owner:test',
  HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example'
};

let capturedGate;
const auth = {
  async login() { return { ok: false }; },
  authenticate() { return { ok: false }; },
  logoutCookie() { return ''; }
};

createCloudSessionNodeServerRuntime({
  env,
  createAuth: () => auth,
  createHttpApi({ loginGate }) {
    capturedGate = loginGate;
    return { async handle() { return { matched: false }; } };
  },
  loginAttempts: 2,
  loginWindowMs: 10_000,
  now: () => 1_000
});

assert.equal(typeof capturedGate, 'function');
const request = { socket: { remoteAddress: '203.0.113.1' } };

const first = capturedGate({ request });
assert.equal(first.ok, true);
assert.equal(typeof first.complete, 'function');
assert.equal(first.complete({ authenticated: false }), true);
assert.equal(first.complete({ authenticated: true }), false, 'a ticket completion must be exactly-once');

const second = capturedGate({ request });
assert.equal(second.ok, true);
assert.equal(second.complete({ authenticated: false }), true);
const exhausted = capturedGate({ request });
assert.equal(exhausted.ok, false);
assert.equal(exhausted.retryAfterSeconds, 10);

let successGate;
createCloudSessionNodeServerRuntime({
  env,
  createAuth: () => auth,
  createHttpApi({ loginGate }) {
    successGate = loginGate;
    return { async handle() { return { matched: false }; } };
  },
  loginAttempts: 2,
  loginWindowMs: 10_000,
  now: () => 1_000
});

const failure = successGate({ request });
failure.complete({ authenticated: false });
const success = successGate({ request });
success.complete({ authenticated: true });
const clean1 = successGate({ request });
clean1.complete({ authenticated: false });
const clean2 = successGate({ request });
assert.equal(clean2.ok, true, 'success must clear earlier failures for that peer');
clean2.complete({ authenticated: false });
assert.equal(successGate({ request }).ok, false);

console.log('cloud session login limiter ticket lifecycle ok');
