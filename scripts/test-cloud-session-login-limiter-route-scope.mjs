import assert from 'node:assert/strict';
import { createCloudSessionHttpApi } from '../lib/cloud-session-http-api.mjs';

let gateCalls = 0;
const auth = {
  async login() { return { ok: false }; },
  authenticate({ headers }) { return headers?.cookie ? { ok: true, expiresAt: 123 } : { ok: false }; },
  logoutCookie() { return 'hafize_session=; Max-Age=0'; }
};
const api = createCloudSessionHttpApi({
  auth,
  allowedOrigin: 'https://hafize.example',
  readJson: async () => ({ password: 'x' }),
  loginGate() { gateCalls += 1; return { ok: false, retryAfterSeconds: 60 }; }
});

const statusAnon = await api.handle({ method: 'GET', pathname: '/api/session/status', headers: {} });
assert.equal(statusAnon.status, 401);
const statusAuth = await api.handle({ method: 'GET', pathname: '/api/session/status', headers: { cookie: 'hafize_session=fake' } });
assert.equal(statusAuth.status, 200);
const logout = await api.handle({ method: 'POST', pathname: '/api/session/logout', headers: { origin: 'https://hafize.example', cookie: 'hafize_session=fake' } });
assert.equal(logout.status, 200);
assert.equal(gateCalls, 0, 'status/logout must not consume or consult the password-login limiter');

const login = await api.handle({ method: 'POST', pathname: '/api/session/login', headers: { origin: 'https://hafize.example' } });
assert.equal(login.status, 429);
assert.equal(gateCalls, 1);

console.log('cloud session login limiter route scope ok');
