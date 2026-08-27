import assert from 'node:assert/strict';
import { CANVA_TOKEN_ENDPOINT, createCanvaTokenExchange } from '../lib/canva-token-exchange.mjs';

const saves = [];
const requests = [];
const exchange = createCanvaTokenExchange({
  clientId: 'client-id',
  clientSecret: 'client-secret',
  tokenStore: { async save(value) { saves.push(value); } },
  now: () => 1_700_000_000_000,
  fetchImpl: async (url, init) => {
    requests.push({ url, init });
    return { ok: true, async json() { return { access_token: 'access-token', refresh_token: 'refresh-token', token_type: 'Bearer', expires_in: 14400, scope: 'asset:read design:meta:read asset:read' }; } };
  }
});

const receipt = await exchange.exchange({ ownerId: 'owner:1', code: 'authorization-code', verifier: 'v'.repeat(43), redirectUri: 'https://example.com/oauth/callback' });
assert.equal(requests.length, 1);
assert.equal(requests[0].url, CANVA_TOKEN_ENDPOINT);
assert.equal(requests[0].init.method, 'POST');
assert.equal(requests[0].init.redirect, 'error');
assert.equal(requests[0].init.headers['content-type'], 'application/x-www-form-urlencoded');
assert.equal(requests[0].init.headers.authorization, `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`);
const body = new URLSearchParams(requests[0].init.body);
assert.deepEqual(Object.fromEntries(body), { grant_type: 'authorization_code', code_verifier: 'v'.repeat(43), code: 'authorization-code', redirect_uri: 'https://example.com/oauth/callback' });
assert.equal(requests[0].init.body.includes('client-secret'), false);
assert.deepEqual(saves, [{ ownerId: 'owner:1', provider: 'canva', tokenRecord: { accessToken: 'access-token', refreshToken: 'refresh-token', tokenType: 'Bearer', scopes: ['asset:read', 'design:meta:read'], expiresAt: 1_700_014_400_000 } }]);
assert.deepEqual(receipt, { provider: 'canva', ownerId: 'owner:1', scopes: ['asset:read', 'design:meta:read'], expiresAt: 1_700_014_400_000, refreshTokenStored: true });
assert.equal(JSON.stringify(receipt).includes('access-token'), false);
assert.equal(JSON.stringify(receipt).includes('refresh-token'), false);
assert.equal(JSON.stringify(receipt).includes('client-secret'), false);

for (const input of [
  {},
  { ownerId: '../owner', code: 'authorization-code', verifier: 'v'.repeat(43), redirectUri: 'https://example.com/callback' },
  { ownerId: 'owner', code: 'short', verifier: 'v'.repeat(43), redirectUri: 'https://example.com/callback' },
  { ownerId: 'owner', code: 'authorization-code', verifier: 'short', redirectUri: 'https://example.com/callback' },
  { ownerId: 'owner', code: 'authorization-code', verifier: 'v'.repeat(43), redirectUri: 'http://example.com/callback' },
  { ownerId: 'owner', code: 'authorization-code', verifier: 'v'.repeat(43), redirectUri: 'https://user:pass@example.com/callback' },
  { ownerId: 'owner', code: 'authorization-code', verifier: 'v'.repeat(43), redirectUri: 'https://example.com/callback#fragment' }
]) await assert.rejects(() => exchange.exchange(input), /INVALID_CANVA_TOKEN_EXCHANGE/);

for (const payload of [null, {}, { access_token: 'a', refresh_token: 'r', token_type: 'MAC', expires_in: 14400 }, { access_token: 'a', refresh_token: 'r', token_type: 'Bearer', expires_in: 1 }, { access_token: 'a', refresh_token: '', token_type: 'Bearer', expires_in: 14400 }, { access_token: 'a', refresh_token: 'r', token_type: 'Bearer', expires_in: 14400, scope: 'x'.repeat(5000) }]) {
  const bad = createCanvaTokenExchange({ clientId: 'id', clientSecret: 'secret', tokenStore: { save: async () => {} }, fetchImpl: async () => ({ ok: true, json: async () => payload }) });
  await assert.rejects(() => bad.exchange({ ownerId: 'owner', code: 'authorization-code', verifier: 'v'.repeat(43), redirectUri: 'https://example.com/callback' }), /CANVA_TOKEN_EXCHANGE_FAILED|INVALID_CANVA_TOKEN_EXCHANGE/);
}
const httpFailure = createCanvaTokenExchange({ clientId: 'id', clientSecret: 'secret', tokenStore: { save: async () => {} }, fetchImpl: async () => ({ ok: false, json: async () => ({}) }) });
await assert.rejects(() => httpFailure.exchange({ ownerId: 'owner', code: 'authorization-code', verifier: 'v'.repeat(43), redirectUri: 'https://example.com/callback' }), /CANVA_TOKEN_EXCHANGE_FAILED:http/);
assert.throws(() => createCanvaTokenExchange({ clientId: 'id', tokenStore: { save() {} } }), /clientSecret/);
assert.throws(() => createCanvaTokenExchange({ clientId: 'id', clientSecret: 'secret' }), /tokenStore/);
assert.throws(() => createCanvaTokenExchange({ clientId: 'id', clientSecret: 'secret', tokenStore: { save() {} }, fetchImpl: null }), /fetch/);
for (const input of [null, undefined, [], 'owner', 7]) {
  await assert.rejects(() => exchange.exchange(input), /INVALID_CANVA_TOKEN_EXCHANGE/);
}
console.log('canva token exchange tests passed');
