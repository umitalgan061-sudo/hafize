import assert from 'node:assert/strict';
import { createCloudSessionHttpApi } from '../lib/cloud-session-http-api.mjs';

const ORIGIN = 'https://hafize.example.test';
const auth = {
  async login() { throw new Error('should not reach auth'); },
  authenticate() { return { ok: false, error: 'AUTH_REQUIRED' }; },
  revoke() { return { ok: false, error: 'AUTH_REQUIRED' }; },
  logoutCookie() { return 'logout-cookie'; }
};

function codedError(code, privateDetail = '') {
  const error = new Error(privateDetail || code);
  error.code = code;
  error.privateDetail = privateDetail;
  return error;
}

async function run(readError) {
  let completed = null;
  const api = createCloudSessionHttpApi({
    auth,
    allowedOrigin: ORIGIN,
    readJson: async () => { throw readError; },
    loginGate: () => ({
      ok: true,
      complete(value) { completed = value; }
    })
  });
  const result = await api.handle({
    request: {},
    method: 'POST',
    pathname: '/api/session/login',
    headers: { origin: ORIGIN, 'content-type': 'application/json' }
  });
  return { result, completed };
}

for (const code of ['CLOUD_SESSION_INVALID_UTF8', 'CLOUD_SESSION_INVALID_CONTENT_LENGTH', 'CLOUD_SESSION_LENGTH_MISMATCH']) {
  const secret = `provider-secret-${code}`;
  const { result, completed } = await run(codedError(code, secret));
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: 'INVALID_REQUEST' });
  assert.equal(JSON.stringify(result).includes(secret), false, 'request parsing details must not cross the public boundary');
  assert.deepEqual(completed, { authenticated: false, countFailure: true }, 'malformed login bytes must count toward abuse budget');
  if (code.includes('LENGTH')) assert.equal(result.headers.connection, 'close');
}

for (const code of ['CLOUD_SESSION_UNSUPPORTED_MEDIA_TYPE', 'CLOUD_SESSION_UNSUPPORTED_CONTENT_ENCODING']) {
  const secret = `codec-secret-${code}`;
  const { result, completed } = await run(codedError(code, secret));
  assert.equal(result.status, 415);
  assert.deepEqual(result.body, { error: 'UNSUPPORTED_MEDIA_TYPE' });
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.deepEqual(completed, { authenticated: false, countFailure: true });
}

{
  const secret = 'raw-password-parser-stack-should-never-leak';
  const { result, completed } = await run(codedError('PRIVATE_DECODER_FAILURE', secret));
  assert.equal(result.status, 500);
  assert.deepEqual(result.body, { error: 'SESSION_AUTH_FAILED' });
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.deepEqual(completed, { authenticated: false, countFailure: true });
}

{
  const syntax = new SyntaxError('Unexpected token password=super-secret-value');
  const { result } = await run(syntax);
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: 'INVALID_REQUEST' });
  assert.equal(JSON.stringify(result).includes('super-secret-value'), false);
}

console.log('cloud session body error policy tests passed');