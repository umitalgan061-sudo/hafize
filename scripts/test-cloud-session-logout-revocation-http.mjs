import assert from 'node:assert/strict';
import { createCloudSessionHttpApi } from '../lib/cloud-session-http-api.mjs';

const allowedOrigin = 'https://hafize.example';
const validHeaders = Object.freeze({ origin: allowedOrigin, cookie: '__Host-hafize_session=valid.token' });

function createRequest(body = {}) {
  return Object.assign((async function* () { yield Buffer.from(JSON.stringify(body)); })(), {
    socket: { remoteAddress: '127.0.0.1' }
  });
}

{
  let revoked = false;
  let revocations = 0;
  const auth = {
    async login() { return { ok: true, expiresAt: 2000, setCookie: '__Host-hafize_session=fresh.token; Path=/' }; },
    authenticate({ headers }) {
      if (headers?.cookie !== validHeaders.cookie || revoked) return { ok: false, error: 'AUTH_REQUIRED' };
      return { ok: true, principal: { authenticated: true, subject: 'user:1' }, expiresAt: 2000 };
    },
    revoke({ headers }) {
      const current = this.authenticate({ headers });
      if (!current.ok) return current;
      revoked = true;
      revocations += 1;
      return { ok: true };
    },
    logoutCookie() { return '__Host-hafize_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'; }
  };
  const api = createCloudSessionHttpApi({ auth, allowedOrigin, readJson: async () => ({ password: 'unused-password' }) });

  const before = await api.handle({ method: 'GET', pathname: '/api/session/status', headers: { cookie: validHeaders.cookie } });
  assert.equal(before.status, 200);
  assert.deepEqual(before.body, { authenticated: true, expiresAt: 2000 });

  const logout = await api.handle({ request: createRequest(), method: 'POST', pathname: '/api/session/logout', headers: validHeaders });
  assert.equal(logout.status, 200);
  assert.deepEqual(logout.body, { authenticated: false });
  assert.match(logout.headers['set-cookie'], /Max-Age=0/);
  assert.equal(revocations, 1);

  const replay = await api.handle({ method: 'GET', pathname: '/api/session/status', headers: { cookie: validHeaders.cookie } });
  assert.equal(replay.status, 401);
  assert.deepEqual(replay.body, { authenticated: false, error: 'AUTH_REQUIRED' });

  const secondLogout = await api.handle({ request: createRequest(), method: 'POST', pathname: '/api/session/logout', headers: validHeaders });
  assert.equal(secondLogout.status, 401);
  assert.equal(secondLogout.headers['set-cookie'], undefined);
  assert.equal(revocations, 1);
}

{
  let revokeCalls = 0;
  const auth = {
    login: async () => ({ ok: false, error: 'AUTH_REQUIRED' }),
    authenticate: () => ({ ok: true, expiresAt: 2000 }),
    revoke() { revokeCalls += 1; return { ok: true }; },
    logoutCookie: () => 'cleared'
  };
  const api = createCloudSessionHttpApi({ auth, allowedOrigin, readJson: async () => ({}) });
  const wrongOrigin = await api.handle({
    request: createRequest(),
    method: 'POST',
    pathname: '/api/session/logout',
    headers: { ...validHeaders, origin: 'https://evil.example' }
  });
  assert.equal(wrongOrigin.status, 403);
  assert.equal(revokeCalls, 0);
  assert.equal(wrongOrigin.headers['set-cookie'], undefined);
}

{
  const auth = {
    login: async () => ({ ok: false, error: 'AUTH_REQUIRED' }),
    authenticate: () => ({ ok: true, expiresAt: 2000 }),
    revoke: () => ({ ok: false, error: 'SESSION_REVOCATION_UNAVAILABLE' }),
    logoutCookie: () => 'must-not-be-used'
  };
  const api = createCloudSessionHttpApi({ auth, allowedOrigin, readJson: async () => ({}) });
  const result = await api.handle({ request: createRequest(), method: 'POST', pathname: '/api/session/logout', headers: validHeaders });
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { authenticated: true, error: 'SESSION_REVOCATION_UNAVAILABLE' });
  assert.equal(result.headers['set-cookie'], undefined);
}

{
  // Legacy test seams remain compatible, but production node runtime injects revocable auth.
  const legacyAuth = {
    login: async () => ({ ok: false, error: 'AUTH_REQUIRED' }),
    authenticate: () => ({ ok: true, expiresAt: 2000 }),
    logoutCookie: () => 'legacy-clear'
  };
  const api = createCloudSessionHttpApi({ auth: legacyAuth, allowedOrigin, readJson: async () => ({}) });
  const result = await api.handle({ request: createRequest(), method: 'POST', pathname: '/api/session/logout', headers: validHeaders });
  assert.equal(result.status, 200);
  assert.equal(result.headers['set-cookie'], 'legacy-clear');
}

console.log('cloud session logout revocation http tests passed');
