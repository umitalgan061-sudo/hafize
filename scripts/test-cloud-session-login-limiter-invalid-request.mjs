import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createCloudSessionNodeServerRuntime } from '../lib/cloud-session-node-server-runtime.mjs';

const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: 'test-hash',
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: '0123456789abcdef0123456789abcdef',
  HAFIZE_CLOUD_SESSION_SUBJECT: 'owner:test',
  HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example'
};

let authCalls = 0;
const auth = {
  async login() {
    authCalls += 1;
    return { ok: false };
  },
  authenticate() { return { ok: false }; },
  revoke() { return false; },
  logoutCookie() { return 'hafize_session=; Max-Age=0'; }
};

function request(raw, remoteAddress = '198.51.100.9') {
  const stream = Readable.from([Buffer.from(raw)]);
  stream.socket = { remoteAddress };
  return stream;
}

const runtime = createCloudSessionNodeServerRuntime({
  env,
  createAuth: () => auth,
  loginAttempts: 2,
  loginWindowMs: 60_000,
  now: () => 2_000
});

async function send(raw, headers = { origin: 'https://hafize.example', 'content-type': 'application/json' }) {
  return runtime.handle({
    request: request(raw),
    method: 'POST',
    pathname: '/api/session/login',
    headers
  });
}

const invalidJson = await send('{not-json');
assert.equal(invalidJson.status, 400);
assert.equal(invalidJson.body.error, 'INVALID_REQUEST');
assert.equal(authCalls, 0, 'malformed JSON must fail before password verification');

const invalidShape = await send('{"password":"x","extra":true}');
assert.equal(invalidShape.status, 400);
assert.equal(authCalls, 0);

const blocked = await send('{"password":"correct"}');
assert.equal(blocked.status, 429, 'malformed login traffic should consume the bounded abuse budget');
assert.equal(authCalls, 0);

const differentPeerStream = Readable.from([Buffer.from('{"password":"wrong"}')]);
differentPeerStream.socket = { remoteAddress: '198.51.100.10' };
const unsupported = await runtime.handle({
  request: differentPeerStream,
  method: 'POST',
  pathname: '/api/session/login',
  headers: { origin: 'https://hafize.example', 'content-type': 'text/plain' }
});
assert.equal(unsupported.status, 415);
assert.equal(authCalls, 0);

const wrongOrigin = await send('{"password":"wrong"}', {
  origin: 'https://attacker.example',
  'content-type': 'application/json'
});
assert.equal(wrongOrigin.status, 403);
assert.equal(wrongOrigin.body.error, 'ORIGIN_REQUIRED');
assert.equal(authCalls, 0, 'cross-origin requests must fail before login-gate/password work');

console.log('cloud session invalid login request budget ok');
