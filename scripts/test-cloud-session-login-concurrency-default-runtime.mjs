import assert from 'node:assert/strict';
import { createCloudSessionNodeServerRuntime } from '../lib/cloud-session-node-server-runtime.mjs';

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

function request(password, remoteAddress) {
  const bytes = Buffer.from(JSON.stringify({ password }));
  return {
    socket: { remoteAddress },
    async *[Symbol.asyncIterator]() { yield bytes; },
    resume() {}
  };
}

function settleEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

const pending = [deferred(), deferred()];
let calls = 0;
const runtime = createCloudSessionNodeServerRuntime({
  env: {
    HAFIZE_CLOUD_SESSION_PASSWORD_HASH: 'stub-hash',
    HAFIZE_CLOUD_SESSION_SIGNING_KEY: 'stub-key',
    HAFIZE_CLOUD_SESSION_SUBJECT: 'owner',
    HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example'
  },
  createAuth() {
    return {
      async login() {
        const index = calls++;
        if (index < 2) return pending[index].promise;
        return { ok: false, error: 'AUTH_REQUIRED' };
      },
      authenticate() { return { ok: false, error: 'AUTH_REQUIRED' }; },
      revoke() { return { ok: false, error: 'AUTH_REQUIRED' }; },
      logoutCookie() { return 'clear'; }
    };
  }
});
const headers = { origin: 'https://hafize.example', 'content-type': 'application/json' };
const args = (password, address) => ({
  request: request(password, address),
  method: 'POST',
  pathname: '/api/session/login',
  headers
});

const first = runtime.handle(args('first-password-long-enough', '198.51.100.1'));
const second = runtime.handle(args('second-password-long-enough', '198.51.100.2'));
await settleEventLoop();
assert.equal(calls, 2, 'default production gate admits two concurrent password verifications');

const third = await runtime.handle(args('third-password-long-enough', '198.51.100.3'));
assert.equal(third.status, 503);
assert.equal(third.body.error, 'SESSION_AUTH_BUSY');
assert.equal(third.headers['retry-after'], '1');
assert.equal(calls, 2, 'third peer must not enter auth.login while both slots are held');

pending[0].resolve({ ok: false, error: 'AUTH_REQUIRED' });
assert.equal((await first).status, 401);
const fourth = await runtime.handle(args('fourth-password-long-enough', '198.51.100.4'));
assert.equal(fourth.status, 401);
assert.equal(calls, 3, 'released slot is immediately reusable by another peer');

pending[1].resolve({ ok: true, expiresAt: 1000, setCookie: '__Host-hafize_session=x; Path=/; Max-Age=60; HttpOnly; Secure; SameSite=Strict' });
assert.equal((await second).status, 200);

const fifth = await runtime.handle(args('fifth-password-long-enough', '198.51.100.5'));
assert.equal(fifth.status, 401);
assert.equal(calls, 4);

process.stdout.write('cloud session default login concurrency runtime tests passed\n');
