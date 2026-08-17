import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createCloudSessionHttpApi } from '../lib/cloud-session-http-api.mjs';

function request(body) { return Readable.from([Buffer.from(JSON.stringify(body))]); }
const headers = { origin: 'https://hafize.example', 'content-type': 'application/json' };
let gateCalls = 0;
const auth = {
  async login({ password }) { return password === 'ok' ? { ok: true, expiresAt: 99, setCookie: 's=fake' } : { ok: false }; },
  authenticate() { return { ok: false }; },
  logoutCookie() { return ''; }
};
const api = createCloudSessionHttpApi({
  auth,
  allowedOrigin: 'https://hafize.example',
  readJson: async (stream) => JSON.parse((await Array.fromAsync(stream)).map(String).join('')),
  loginGate() { gateCalls += 1; return { ok: true }; }
});

const success = await api.handle({ request: request({ password: 'ok' }), method: 'POST', pathname: '/api/session/login', headers });
assert.equal(success.status, 200);
const failure = await api.handle({ request: request({ password: 'bad' }), method: 'POST', pathname: '/api/session/login', headers });
assert.equal(failure.status, 401);
assert.equal(gateCalls, 2, 'existing gates without complete() remain supported');

const blockedApi = createCloudSessionHttpApi({ auth, allowedOrigin: 'https://hafize.example', readJson: async () => ({ password: 'ok' }), loginGate: () => ({ ok: false, retryAfterSeconds: 7 }) });
const blocked = await blockedApi.handle({ request: request({ password: 'ok' }), method: 'POST', pathname: '/api/session/login', headers });
assert.equal(blocked.status, 429);
assert.equal(blocked.headers['retry-after'], '7');

console.log('cloud session login gate compatibility ok');
