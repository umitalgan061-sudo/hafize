import assert from 'node:assert/strict';
import { createCloudSessionNodeServerRuntime, CLOUD_SESSION_SERVER_ENV } from '../lib/cloud-session-node-server-runtime.mjs';

const ORIGIN = 'https://hafize.example.test';
const env = {
  [CLOUD_SESSION_SERVER_ENV.passwordHash]: 'placeholder-password-hash',
  [CLOUD_SESSION_SERVER_ENV.signingKey]: 'placeholder-signing-key',
  [CLOUD_SESSION_SERVER_ENV.subject]: 'owner@example.test',
  [CLOUD_SESSION_SERVER_ENV.origin]: ORIGIN
};
let observedPassword = null;
const auth = {
  async login({ password }) {
    observedPassword = password;
    return { ok: false, error: 'AUTH_REQUIRED' };
  },
  authenticate() { return { ok: false, error: 'AUTH_REQUIRED' }; },
  revoke() { return { ok: false, error: 'AUTH_REQUIRED' }; },
  logoutCookie() { return '__Host-hafize_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'; }
};
const runtime = createCloudSessionNodeServerRuntime({ env, createAuth: () => auth, loginAttempts: 20, maxRateKeys: 16 });

function chunkedRequest(chunks, length, peer = '203.0.113.30') {
  return {
    headers: { 'content-type': 'application/json', 'content-length': String(length) },
    socket: { remoteAddress: peer },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
    resume() {}
  };
}

async function login(request) {
  return runtime.handle({
    request,
    method: 'POST',
    pathname: '/api/session/login',
    headers: { ...request.headers, origin: ORIGIN }
  });
}

{
  const text = '{"password":"şifre-🔐-漢字"}';
  const bytes = Buffer.from(text, 'utf8');
  const emojiStart = bytes.indexOf(Buffer.from('🔐'));
  assert.ok(emojiStart > 0);
  const chunks = [
    bytes.subarray(0, emojiStart + 1),
    bytes.subarray(emojiStart + 1, emojiStart + 3),
    bytes.subarray(emojiStart + 3)
  ];
  const result = await login(chunkedRequest(chunks, bytes.length));
  assert.equal(result.status, 401);
  assert.equal(observedPassword, 'şifre-🔐-漢字', 'valid UTF-8 split across transport chunks must decode exactly once after reassembly');
}

{
  observedPassword = null;
  const prefix = Buffer.from('{"password":"safe-');
  const invalidLead = Buffer.from([0xe2]);
  const invalidTail = Buffer.from([0x28, 0xa1]);
  const suffix = Buffer.from('"}');
  const chunks = [prefix, invalidLead, invalidTail, suffix];
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = await login(chunkedRequest(chunks, size, '203.0.113.31'));
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: 'INVALID_REQUEST' });
  assert.equal(observedPassword, null, 'invalid sequence spanning chunks must not reach auth');
}

{
  observedPassword = null;
  const text = '{"password":"é"}';
  const bytes = Buffer.from(text, 'utf8');
  const chunks = [...bytes].map((byte) => Buffer.from([byte]));
  const result = await login(chunkedRequest(chunks, bytes.length, '203.0.113.32'));
  assert.equal(result.status, 401, 'one-byte transport chunks must preserve valid UTF-8');
  assert.equal(observedPassword, 'é');
}

{
  observedPassword = null;
  const bytes = Buffer.from('{"password":"value"}');
  const result = await login(chunkedRequest([bytes.subarray(0, 5), bytes.subarray(5)], bytes.length + 1, '203.0.113.33'));
  assert.equal(result.status, 400);
  assert.equal(result.headers.connection, 'close');
  assert.equal(observedPassword, null, 'length equality applies after all chunks are reassembled');
}

console.log('cloud session body chunk boundary tests passed');