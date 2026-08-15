import assert from 'node:assert/strict';
import { createCloudSessionHttpApi, CLOUD_SESSION_HTTP_PATHS } from '../lib/cloud-session-http-api.mjs';

const calls = [];
const auth = {
  async login({ password }) {
    calls.push(['login', password]);
    return password === 'valid password value'
      ? { ok: true, expiresAt: 2000, setCookie: '__Host-hafize_session=signed; Path=/; HttpOnly; Secure; SameSite=Strict' }
      : { ok: false, error: 'AUTH_REQUIRED' };
  },
  authenticate({ headers }) {
    calls.push(['authenticate', headers]);
    return headers?.cookie?.includes('signed')
      ? { ok: true, expiresAt: 2000, principal: { authenticated: true, subject: 'user' } }
      : { ok: false, error: 'AUTH_REQUIRED' };
  },
  logoutCookie() { return '__Host-hafize_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'; }
};
const api = createCloudSessionHttpApi({
  auth,
  allowedOrigin: 'https://hafize.example.test',
  readJson: async (request) => request.body
});
const originHeaders = { origin: 'https://hafize.example.test' };

{
  const result = await api.handle({ request: { body: { password: 'valid password value' } }, method: 'POST', pathname: CLOUD_SESSION_HTTP_PATHS.login, headers: originHeaders });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { authenticated: true, expiresAt: 2000 });
  assert.match(result.headers['set-cookie'], /^__Host-hafize_session=/);
  assert.equal(result.headers['cache-control'], 'no-store');
}

{
  const result = await api.handle({ request: { body: { password: 'valid password value' } }, method: 'POST', pathname: CLOUD_SESSION_HTTP_PATHS.login, headers: { origin: 'https://evil.example' } });
  assert.equal(result.status, 403);
  assert.deepEqual(result.body, { error: 'ORIGIN_REQUIRED' });
}

{
  let gateCalls = 0;
  const gatedApi = createCloudSessionHttpApi({
    auth,
    allowedOrigin: 'https://hafize.example.test',
    readJson: async (request) => request.body,
    loginGate: async () => { gateCalls += 1; return { ok: false, retryAfterSeconds: 17 }; }
  });
  assert.equal((await gatedApi.handle({ request: { body: { password: 'valid password value' } }, method: 'POST', pathname: CLOUD_SESSION_HTTP_PATHS.login, headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal(gateCalls, 0, 'cross-origin login must fail before rate-limit accounting');
  const limited = await gatedApi.handle({ request: { body: { password: 'valid password value' } }, method: 'POST', pathname: CLOUD_SESSION_HTTP_PATHS.login, headers: originHeaders });
  assert.equal(limited.status, 429);
  assert.deepEqual(limited.body, { error: 'RATE_LIMITED' });
  assert.equal(limited.headers['retry-after'], '17');
}

{
  const result = await api.handle({ request: { body: { password: 'valid password value', ownerId: 'owner_x' } }, method: 'POST', pathname: CLOUD_SESSION_HTTP_PATHS.login, headers: originHeaders });
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: 'INVALID_REQUEST' });
}

for (const [code, expectedStatus, expectedError] of [
  ['CLOUD_SESSION_BODY_TOO_LARGE', 413, 'BODY_TOO_LARGE'],
  ['CLOUD_SESSION_BODY_TIMEOUT', 408, 'REQUEST_TIMEOUT'],
  ['CLOUD_SESSION_UNSUPPORTED_MEDIA_TYPE', 415, 'UNSUPPORTED_MEDIA_TYPE']
]) {
  const defensiveApi = createCloudSessionHttpApi({
    auth,
    allowedOrigin: 'https://hafize.example.test',
    readJson: async () => { const error = new Error(code); error.code = code; throw error; }
  });
  const result = await defensiveApi.handle({ request: {}, method: 'POST', pathname: CLOUD_SESSION_HTTP_PATHS.login, headers: originHeaders });
  assert.equal(result.status, expectedStatus);
  assert.equal(result.body.error, expectedError);
  if (expectedStatus === 408 || expectedStatus === 413) assert.equal(result.headers.connection, 'close');
}

{
  const result = await api.handle({ method: 'GET', pathname: CLOUD_SESSION_HTTP_PATHS.status, headers: { cookie: '__Host-hafize_session=signed' } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { authenticated: true, expiresAt: 2000 });
  assert.equal('principal' in result.body, false);
}

{
  const result = await api.handle({ method: 'GET', pathname: CLOUD_SESSION_HTTP_PATHS.status, headers: {} });
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { authenticated: false, error: 'AUTH_REQUIRED' });
}

{
  const result = await api.handle({ method: 'POST', pathname: CLOUD_SESSION_HTTP_PATHS.logout, headers: { ...originHeaders, cookie: '__Host-hafize_session=signed' } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { authenticated: false });
  assert.match(result.headers['set-cookie'], /Max-Age=0/);
}

assert.equal((await api.handle({ method: 'GET', pathname: CLOUD_SESSION_HTTP_PATHS.login, headers: originHeaders })).status, 405);
assert.deepEqual(await api.handle({ method: 'GET', pathname: '/api/other' }), { matched: false });
assert.throws(() => createCloudSessionHttpApi({ auth, allowedOrigin: 'http://hafize.example.test', readJson: async () => ({}) }), /INVALID_CLOUD_SESSION_HTTP:origin/);
assert.throws(() => createCloudSessionHttpApi({ auth, allowedOrigin: 'https://hafize.example.test', readJson: async () => ({}), loginGate: true }), /INVALID_CLOUD_SESSION_HTTP:loginGate/);
assert.equal(JSON.stringify(calls).includes('valid password value'), true);

console.log('cloud session HTTP boundary tests passed');
