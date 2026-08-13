import assert from 'node:assert/strict';
import { createGoogleTokenExchange, GOOGLE_TOKEN_ENDPOINT } from '../lib/google-token-exchange.mjs';

const saved = [];
const requests = [];
const exchange = createGoogleTokenExchange({
  clientId: 'client-id.apps.googleusercontent.com',
  clientSecret: 'server-secret',
  tokenStore: { async save(value) { saved.push(value); } },
  fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      async json() {
        return { access_token: 'access-token-value', refresh_token: 'refresh-token-value', token_type: 'Bearer', expires_in: 3600, scope: 'openid email https://www.googleapis.com/auth/gmail.readonly' };
      }
    };
  },
  now: () => 1_700_000_000_000
});

const receipt = await exchange.exchange({
  ownerId: 'user:123',
  code: 'authorization-code',
  verifier: 'a'.repeat(43),
  redirectUri: 'https://hafize.example.test/oauth/google'
});
assert.equal(requests.length, 1);
assert.equal(requests[0].url, GOOGLE_TOKEN_ENDPOINT);
assert.equal(requests[0].options.method, 'POST');
assert.equal(requests[0].options.redirect, 'error');
assert.equal(requests[0].options.headers['content-type'], 'application/x-www-form-urlencoded');
const form = new URLSearchParams(requests[0].options.body);
assert.equal(form.get('client_id'), 'client-id.apps.googleusercontent.com');
assert.equal(form.get('client_secret'), 'server-secret');
assert.equal(form.get('grant_type'), 'authorization_code');
assert.equal(form.get('code'), 'authorization-code');
assert.equal(form.get('code_verifier'), 'a'.repeat(43));
assert.equal(saved.length, 1);
assert.equal(saved[0].accessToken, 'access-token-value');
assert.equal(saved[0].refreshToken, 'refresh-token-value');
assert.equal(saved[0].ownerId, 'user:123');
assert.equal(receipt.provider, 'google');
assert.equal(receipt.ownerId, 'user:123');
assert.equal(receipt.refreshTokenStored, true);
assert.equal('accessToken' in receipt, false);
assert.equal('refreshToken' in receipt, false);
assert.equal(JSON.stringify(receipt).includes('server-secret'), false);

const withoutSecretRequests = [];
const publicClient = createGoogleTokenExchange({
  clientId: 'public-client',
  tokenStore: { async save() {} },
  fetchImpl: async (url, options) => {
    withoutSecretRequests.push(options.body);
    return { ok: true, async json() { return { access_token: 'token-value', token_type: 'bearer', expires_in: 120 }; } };
  }
});
await publicClient.exchange({ ownerId: 'owner1', code: '12345678', verifier: 'b'.repeat(43), redirectUri: 'https://hafize.example.test/oauth/google' });
assert.equal(new URLSearchParams(withoutSecretRequests[0]).has('client_secret'), false);

for (const invalidFactory of [
  {},
  { clientId: '', tokenStore: { save() {} } },
  { clientId: 'id', tokenStore: {} },
  { clientId: 'id', tokenStore: { save() {} }, fetchImpl: null }
]) assert.throws(() => createGoogleTokenExchange(invalidFactory), /INVALID_GOOGLE_TOKEN_EXCHANGE/);

const badInput = createGoogleTokenExchange({ clientId: 'id', tokenStore: { async save() {} }, fetchImpl: async () => ({ ok: true, async json() { return { access_token: 'token', token_type: 'Bearer', expires_in: 3600 }; } }) });
await assert.rejects(() => badInput.exchange({ ownerId: '../other', code: '12345678', verifier: 'c'.repeat(43), redirectUri: 'https://hafize.example.test/oauth/google' }), /INVALID_GOOGLE_TOKEN_EXCHANGE/);
await assert.rejects(() => badInput.exchange({ ownerId: 'owner', code: 'short', verifier: 'c'.repeat(43), redirectUri: 'https://hafize.example.test/oauth/google' }), /INVALID_GOOGLE_TOKEN_EXCHANGE/);
await assert.rejects(() => badInput.exchange({ ownerId: 'owner', code: '12345678', verifier: 'short', redirectUri: 'https://hafize.example.test/oauth/google' }), /INVALID_GOOGLE_TOKEN_EXCHANGE/);
await assert.rejects(() => badInput.exchange({ ownerId: 'owner', code: '12345678', verifier: 'c'.repeat(43), redirectUri: 'http://hafize.example.test/oauth/google' }), /INVALID_GOOGLE_TOKEN_EXCHANGE/);

const httpFailure = createGoogleTokenExchange({ clientId: 'id', tokenStore: { async save() {} }, fetchImpl: async () => ({ ok: false, async json() { return {}; } }) });
await assert.rejects(() => httpFailure.exchange({ ownerId: 'owner', code: '12345678', verifier: 'd'.repeat(43), redirectUri: 'https://hafize.example.test/oauth/google' }), /GOOGLE_TOKEN_EXCHANGE_FAILED:http/);

console.log('google token exchange tests passed');
