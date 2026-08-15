import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ui = require('../public/cloud-session-ui.js');

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; }
  };
}

const calls = [];
const replies = [
  response(200, { authenticated: true, expiresAt: '2026-08-16T00:00:00.000Z' }),
  response(200, { authenticated: true }),
  response(200, { authenticated: false }),
  response(200, { linked: true }),
  response(200, { linked: false, disconnected: true }),
  response(200, { authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test&state=opaque' })
];
const client = ui.createAccountClient({
  async fetchImpl(path, init) {
    calls.push({ path, init });
    return replies.shift();
  }
});

assert.deepEqual(await client.sessionStatus(), {
  ok: true,
  status: 200,
  payload: { authenticated: true, expiresAt: '2026-08-16T00:00:00.000Z' }
});
assert.deepEqual(await client.login('correct horse battery staple'), {
  ok: true,
  status: 200,
  payload: { authenticated: true }
});
assert.deepEqual(await client.logout(), {
  ok: true,
  status: 200,
  payload: { authenticated: false }
});
assert.deepEqual(await client.gmailStatus(), {
  ok: true,
  status: 200,
  payload: { linked: true }
});
assert.deepEqual(await client.disconnectGmail(), {
  ok: true,
  status: 200,
  payload: { linked: false, disconnected: true }
});
const oauth = await client.startGmailOAuth();
assert.equal(oauth.ok, true);
assert.equal(oauth.authorizationUrl.startsWith('https://accounts.google.com/'), true);

assert.equal(calls.length, 6);
for (const call of calls) {
  assert.equal(call.init.credentials, 'same-origin');
  assert.equal(call.init.cache, 'no-store');
  assert.equal(call.init.headers.Accept, 'application/json');
  assert.equal('authorization' in call.init.headers, false);
  assert.equal('Authorization' in call.init.headers, false);
}
assert.equal(calls[0].path, ui.PATHS.status);
assert.equal(calls[0].init.method, 'GET');
assert.equal(calls[1].path, ui.PATHS.login);
assert.equal(calls[1].init.method, 'POST');
assert.equal(calls[1].init.headers['Content-Type'], 'application/json');
assert.deepEqual(JSON.parse(calls[1].init.body), { password: 'correct horse battery staple' });
assert.deepEqual(Object.keys(JSON.parse(calls[1].init.body)), ['password']);
assert.equal(calls[2].path, ui.PATHS.logout);
assert.equal(calls[2].init.body, '{}');
assert.equal(calls[3].path, ui.PATHS.gmailStatus);
assert.equal(calls[3].init.method, 'GET');
assert.equal(calls[4].path, ui.PATHS.gmailDisconnect);
assert.equal(calls[4].init.method, 'POST');
assert.deepEqual(JSON.parse(calls[4].init.body), { explicitUserIntent: true });
assert.deepEqual(Object.keys(JSON.parse(calls[4].init.body)), ['explicitUserIntent']);
assert.equal(calls[5].path, ui.PATHS.gmailStart);
assert.deepEqual(JSON.parse(calls[5].init.body), { capabilities: ['identity', 'gmail.read'] });
assert.deepEqual(ui.GOOGLE_CAPABILITIES, ['identity', 'gmail.read']);

assert.throws(() => client.login(''), /PASSWORD_REQUIRED/);
assert.throws(() => client.login(null), /PASSWORD_REQUIRED/);

const safeGoogleUrls = [
  'https://accounts.google.com/o/oauth2/v2/auth',
  'https://accounts.google.com/o/oauth2/v2/auth?client_id=x&scope=y'
];
for (const value of safeGoogleUrls) {
  assert.equal(ui.normalizeAuthorizationUrl(value).startsWith('https://accounts.google.com/'), true);
}
for (const value of [
  'http://accounts.google.com/o/oauth2/v2/auth',
  'https://evil.example/o/oauth2/v2/auth',
  'https://accounts.google.com.evil.example/o/oauth2/v2/auth',
  'https://accounts.google.com@evil.example/o/oauth2/v2/auth',
  'https://user:pass@accounts.google.com/o/oauth2/v2/auth',
  'https://accounts.google.com:444/o/oauth2/v2/auth',
  'https://accounts.google.com/o/oauth2/v2/auth#fragment',
  'not-a-url',
  ''
]) assert.throws(() => ui.normalizeAuthorizationUrl(value), /INVALID_GOOGLE_AUTHORIZATION_URL/);

assert.deepEqual(ui.inspectOAuthPopup(null, 'https://hafize.example'), { state: 'closed' });
assert.deepEqual(ui.inspectOAuthPopup({ closed: true }, 'https://hafize.example'), { state: 'closed' });
assert.deepEqual(ui.inspectOAuthPopup({
  closed: false,
  location: { href: 'about:blank' }
}, 'https://hafize.example'), { state: 'pending' });
assert.deepEqual(ui.inspectOAuthPopup({
  closed: false,
  get location() { throw new Error('cross origin'); }
}, 'https://hafize.example'), { state: 'pending' });
assert.deepEqual(ui.inspectOAuthPopup({
  closed: false,
  location: { href: 'https://accounts.google.com/o/oauth2/v2/auth?state=x' }
}, 'https://hafize.example'), { state: 'pending' });
assert.deepEqual(ui.inspectOAuthPopup({
  closed: false,
  location: { href: 'https://hafize.example/not-the-callback' },
  document: { body: { textContent: '{"linked":true}' } }
}, 'https://hafize.example'), { state: 'pending' });
assert.deepEqual(ui.inspectOAuthPopup({
  closed: false,
  location: { href: 'https://hafize.example/api/connectors/gmail/oauth/callback?state=x&code=y' },
  document: { body: { textContent: '{"linked":true,"provider":"google"}' } }
}, 'https://hafize.example'), { state: 'complete', linked: true });
assert.deepEqual(ui.inspectOAuthPopup({
  closed: false,
  location: { href: 'https://hafize.example/api/connectors/gmail/oauth/callback?state=x&error=access_denied' },
  document: { body: { textContent: '{"error":"OAUTH_PROVIDER_DENIED"}' } }
}, 'https://hafize.example'), { state: 'complete', linked: false, error: 'OAUTH_PROVIDER_DENIED' });
assert.deepEqual(ui.inspectOAuthPopup({
  closed: false,
  location: { href: 'https://hafize.example/api/connectors/gmail/oauth/callback?state=x' },
  document: { body: { textContent: 'not json' } }
}, 'https://hafize.example'), { state: 'complete', linked: false, error: 'GOOGLE_OAUTH_FAILED' });

const invalidPayloadClient = ui.createAccountClient({
  fetchImpl: async () => ({ ok: false, status: 502, async json() { throw new Error('invalid json'); } })
});
assert.deepEqual(await invalidPayloadClient.sessionStatus(), { ok: false, status: 502, payload: {} });

const unsafeStartClient = ui.createAccountClient({
  fetchImpl: async () => response(200, { authorizationUrl: 'https://accounts.google.com.evil.example/auth' })
});
await assert.rejects(() => unsafeStartClient.startGmailOAuth(), /INVALID_GOOGLE_AUTHORIZATION_URL/);

console.log('cloud session UI client tests passed');
