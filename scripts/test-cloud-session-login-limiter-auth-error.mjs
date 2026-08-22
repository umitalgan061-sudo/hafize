import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createCloudSessionNodeServerRuntime } from '../lib/cloud-session-node-server-runtime.mjs';

const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: 'test-hash',
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: '0123456789abcdef0123456789abcdef',
  HAFIZE_CLOUD_SESSION_SUBJECT: 'owner:test',
  HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example'
};
let calls = 0;
const auth = {
  async login() {
    calls += 1;
    throw new Error('internal-auth-detail-must-not-leak');
  },
  authenticate() { return { ok: false }; },
  revoke() { return false; },
  logoutCookie() { return ''; }
};
const runtime = createCloudSessionNodeServerRuntime({ env, createAuth: () => auth, loginAttempts: 2, now: () => 1_000 });

async function login() {
  const request = Readable.from([Buffer.from('{"password":"x"}')]);
  request.socket = { remoteAddress: '203.0.113.88' };
  return runtime.handle({ request, method: 'POST', pathname: '/api/session/login', headers: { origin: 'https://hafize.example', 'content-type': 'application/json' } });
}

const first = await login();
assert.equal(first.status, 500);
assert.deepEqual(first.body, { error: 'SESSION_AUTH_FAILED' });
const second = await login();
assert.equal(second.status, 500);
const third = await login();
assert.equal(third.status, 429, 'repeated auth subsystem failures must not permit unbounded login work');
assert.equal(calls, 2, 'rate-limited request must not call auth.login');
assert.equal(JSON.stringify(first).includes('internal-auth-detail-must-not-leak'), false);

console.log('cloud session auth-error limiter behavior ok');
