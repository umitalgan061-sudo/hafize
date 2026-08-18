import assert from 'node:assert/strict';
import { createCloudSessionNodeServerRuntime, CLOUD_SESSION_SERVER_ENV } from '../lib/cloud-session-node-server-runtime.mjs';

const ORIGIN = 'https://hafize.example.test';
const env = {
  [CLOUD_SESSION_SERVER_ENV.passwordHash]: 'placeholder-password-hash',
  [CLOUD_SESSION_SERVER_ENV.signingKey]: 'placeholder-signing-key',
  [CLOUD_SESSION_SERVER_ENV.subject]: 'owner@example.test',
  [CLOUD_SESSION_SERVER_ENV.origin]: ORIGIN
};
let loginCalls = 0;
const auth = {
  async login() { loginCalls += 1; return { ok: false, error: 'AUTH_REQUIRED' }; },
  authenticate() { return { ok: false, error: 'AUTH_REQUIRED' }; },
  revoke() { return { ok: false, error: 'AUTH_REQUIRED' }; },
  logoutCookie() { return '__Host-hafize_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'; }
};
const runtime = createCloudSessionNodeServerRuntime({ env, createAuth: () => auth, loginAttempts: 50, maxRateKeys: 16 });
const body = Buffer.from('{"password":"value"}');

function request(headers) {
  return {
    headers,
    socket: { remoteAddress: '203.0.113.21' },
    async *[Symbol.asyncIterator]() { yield body; },
    resume() {}
  };
}

async function attempt(headers) {
  const req = request(headers);
  return runtime.handle({
    request: req,
    method: 'POST',
    pathname: '/api/session/login',
    headers: { ...headers, origin: ORIGIN }
  });
}

for (const contentType of [
  'application/json',
  'application/json; charset=utf-8',
  'application/json; charset="utf-8"',
  'APPLICATION/JSON; CHARSET=UTF-8'
]) {
  const before = loginCalls;
  const result = await attempt({ 'content-type': contentType });
  assert.equal(result.status, 401, `${contentType} should be accepted`);
  assert.equal(loginCalls, before + 1);
}

for (const contentType of [
  '',
  'text/json',
  'application/problem+json',
  'application/json; charset=iso-8859-1',
  'application/json; profile="https://example.test/schema"',
  'application/json; charset=utf-8; profile=x'
]) {
  const before = loginCalls;
  const headers = contentType ? { 'content-type': contentType } : {};
  const result = await attempt(headers);
  assert.equal(result.status, 415, `${contentType || 'missing content-type'} must fail closed`);
  assert.equal(result.body.error, 'UNSUPPORTED_MEDIA_TYPE');
  assert.equal(loginCalls, before, 'unsupported media type must not verify passwords');
}

{
  const before = loginCalls;
  const result = await attempt({ 'content-type': 'application/json', 'content-encoding': 'identity' });
  assert.equal(result.status, 401);
  assert.equal(loginCalls, before + 1, 'identity encoding preserves exact JSON bytes');
}

for (const encoding of ['gzip', 'br', 'deflate', 'gzip, br']) {
  const before = loginCalls;
  const result = await attempt({ 'content-type': 'application/json', 'content-encoding': encoding });
  assert.equal(result.status, 415, `${encoding} request decompression must not be accepted at the auth boundary`);
  assert.equal(result.body.error, 'UNSUPPORTED_MEDIA_TYPE');
  assert.equal(loginCalls, before);
}

console.log('cloud session body media policy tests passed');