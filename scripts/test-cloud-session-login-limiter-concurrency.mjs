import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createCloudSessionNodeServerRuntime } from '../lib/cloud-session-node-server-runtime.mjs';

const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: 'test-hash',
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: '0123456789abcdef0123456789abcdef',
  HAFIZE_CLOUD_SESSION_SUBJECT: 'owner:test',
  HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example'
};

function deferred() {
  let resolve;
  const promise = new Promise((value) => { resolve = value; });
  return { promise, resolve };
}

const pending = [];
const auth = {
  login() {
    const item = deferred();
    pending.push(item);
    return item.promise;
  },
  authenticate() { return { ok: false }; },
  revoke() { return false; },
  logoutCookie() { return 'hafize_session=; Max-Age=0'; }
};

function request() {
  const stream = Readable.from([Buffer.from('{"password":"candidate"}')]);
  stream.socket = { remoteAddress: '192.0.2.8' };
  return stream;
}

const runtime = createCloudSessionNodeServerRuntime({
  env,
  createAuth: () => auth,
  loginAttempts: 2,
  loginWindowMs: 60_000,
  now: () => 5_000
});

function login() {
  return runtime.handle({
    request: request(),
    method: 'POST',
    pathname: '/api/session/login',
    headers: { origin: 'https://hafize.example', 'content-type': 'application/json' }
  });
}

const firstPromise = login();
const secondPromise = login();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(pending.length, 2, 'two authentication operations should be in flight');

const third = await login();
assert.equal(third.status, 429, 'pending authentication reservations must count against the bounded attempt budget');
assert.equal(pending.length, 2, 'rate-limited login must not reach password verification');

pending[0].resolve({ ok: false });
const first = await firstPromise;
assert.equal(first.status, 401);

const stillBlocked = await login();
assert.equal(stillBlocked.status, 429, 'one failed plus one pending attempt must still exhaust a two-attempt budget');

pending[1].resolve({ ok: true, expiresAt: 50_000, setCookie: 'hafize_session=fake; HttpOnly; Secure; SameSite=Strict' });
const second = await secondPromise;
assert.equal(second.status, 200);

const afterSuccessPromise = login();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(pending.length, 3, 'successful authentication must clear prior failure and pending state for the peer');
pending[2].resolve({ ok: true, expiresAt: 50_001, setCookie: 'hafize_session=fake2; HttpOnly; Secure; SameSite=Strict' });
assert.equal((await afterSuccessPromise).status, 200);

console.log('cloud session login limiter concurrency ok');
