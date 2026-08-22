import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createCloudSessionNodeServerRuntime } from '../lib/cloud-session-node-server-runtime.mjs';

const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: 'test-hash',
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: '0123456789abcdef0123456789abcdef',
  HAFIZE_CLOUD_SESSION_SUBJECT: 'owner:test',
  HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example'
};
const auth = {
  async login() { return { ok: false }; },
  authenticate() { return { ok: false }; },
  revoke() { return false; },
  logoutCookie() { return ''; }
};
const runtime = createCloudSessionNodeServerRuntime({ env, createAuth: () => auth, loginAttempts: 2, now: () => 1_000 });

async function login(remoteAddress, forwardedFor) {
  const request = Readable.from([Buffer.from('{"password":"wrong"}')]);
  request.socket = { remoteAddress };
  return runtime.handle({
    request,
    method: 'POST',
    pathname: '/api/session/login',
    headers: {
      origin: 'https://hafize.example',
      'content-type': 'application/json',
      'x-forwarded-for': forwardedFor
    }
  });
}

assert.equal((await login('10.0.0.5', '198.51.100.1')).status, 401);
assert.equal((await login('10.0.0.5', '198.51.100.2')).status, 401);
assert.equal((await login('10.0.0.5', '198.51.100.3')).status, 429, 'rotating X-Forwarded-For must not bypass socket-peer limiting');
assert.equal((await login('10.0.0.6', '198.51.100.1')).status, 401, 'same forwarded value on another socket peer must not share state');

console.log('cloud session forwarded-for bypass guard ok');
