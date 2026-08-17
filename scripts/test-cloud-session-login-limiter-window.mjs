import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createCloudSessionNodeServerRuntime } from '../lib/cloud-session-node-server-runtime.mjs';

const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: 'test-hash',
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: '0123456789abcdef0123456789abcdef',
  HAFIZE_CLOUD_SESSION_SUBJECT: 'owner:test',
  HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example'
};

let clock = 1_000;
function request(password, remoteAddress = '10.0.0.7') {
  const stream = Readable.from([Buffer.from(JSON.stringify({ password }))]);
  stream.socket = { remoteAddress };
  return stream;
}

const auth = {
  async login() { return { ok: false }; },
  authenticate() { return { ok: false }; },
  logoutCookie() { return 'hafize_session=; Max-Age=0'; }
};

const runtime = createCloudSessionNodeServerRuntime({
  env,
  createAuth: () => auth,
  loginAttempts: 2,
  loginWindowMs: 5_000,
  now: () => clock
});

async function login(address = '10.0.0.7') {
  return runtime.handle({
    request: request('wrong', address),
    method: 'POST',
    pathname: '/api/session/login',
    headers: { origin: 'https://hafize.example', 'content-type': 'application/json' }
  });
}

assert.equal((await login()).status, 401);
clock += 1_000;
assert.equal((await login()).status, 401);
clock += 1_000;
const blocked = await login();
assert.equal(blocked.status, 429);
assert.equal(blocked.headers['retry-after'], '3');

const otherPeer = await login('10.0.0.8');
assert.equal(otherPeer.status, 401, 'failure budget must remain scoped to the socket peer key');

clock = 6_001;
const reset = await login();
assert.equal(reset.status, 401, 'expired failure windows must reset instead of remaining permanently blocked');

clock = 6_002;
assert.equal((await login()).status, 401);
clock = 6_003;
assert.equal((await login()).status, 429);

console.log('cloud session login limiter window ok');
