import assert from 'node:assert/strict';
import { createCloudSessionNodeServerRuntime } from '../lib/cloud-session-node-server-runtime.mjs';

const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: 'x',
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: '0123456789abcdef0123456789abcdef',
  HAFIZE_CLOUD_SESSION_SUBJECT: 'owner:test',
  HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example'
};
let gate;
let clock = 1_000;
const auth = { async login() { return { ok: false }; }, authenticate() { return { ok: false }; }, revoke() { return false; }, logoutCookie() { return ''; } };
createCloudSessionNodeServerRuntime({
  env,
  createAuth: () => auth,
  createHttpApi({ loginGate }) { gate = loginGate; return { async handle() { return { matched: false }; } }; },
  loginAttempts: 1,
  loginWindowMs: 10_000,
  now: () => clock
});
const request = { socket: { remoteAddress: '203.0.113.70' } };
const first = gate({ request });
first.complete({ authenticated: false });
assert.equal(gate({ request }).retryAfterSeconds, 10);
clock = 5_500;
assert.equal(gate({ request }).retryAfterSeconds, 6);
clock = 10_999;
assert.equal(gate({ request }).retryAfterSeconds, 1);
clock = 11_001;
const reset = gate({ request });
assert.equal(reset.ok, true);
reset.complete({ authenticated: false });

console.log('cloud session limiter retry-after ok');
