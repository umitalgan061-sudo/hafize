import assert from 'node:assert/strict';
import { CANVA_REFRESH_TOKEN_ENDPOINT, createCanvaTokenRefresh } from '../lib/canva-token-refresh.mjs';

const loads = [];
const saves = [];
const requests = [];
const runtime = createCanvaTokenRefresh({
  clientId: 'client-id',
  clientSecret: 'client-secret',
  tokenStore: {
    async load(input) {
      loads.push(input);
      return { accessToken: 'old-access', refreshToken: 'old-refresh', tokenType: 'Bearer', scopes: ['asset:read', 'design:meta:read'], expiresAt: 1 };
    },
    async save(input) { saves.push(input); }
  },
  now: () => 1_700_000_000_000,
  fetchImpl: async (url, init) => {
    requests.push({ url, init });
    return { ok: true, async json() { return { access_token: 'new-access', refresh_token: 'new-refresh', token_type: 'Bearer', expires_in: 14400, scope: 'asset:read design:meta:read asset:read' }; } };
  }
});

const receipt = await runtime.refresh({ ownerId: 'owner:1' });
assert.deepEqual(loads, [{ ownerId: 'owner:1', provider: 'canva' }]);
assert.equal(requests.length, 1);
assert.equal(requests[0].url, CANVA_REFRESH_TOKEN_ENDPOINT);
assert.equal(requests[0].init.method, 'POST');
assert.equal(requests[0].init.redirect, 'error');
assert.equal(requests[0].init.headers.authorization, `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`);
assert.equal(requests[0].init.headers['content-type'], 'application/x-www-form-urlencoded');
assert.deepEqual(Object.fromEntries(new URLSearchParams(requests[0].init.body)), { grant_type: 'refresh_token', refresh_token: 'old-refresh' });
assert.deepEqual(saves, [{ ownerId: 'owner:1', provider: 'canva', tokenRecord: { accessToken: 'new-access', refreshToken: 'new-refresh', tokenType: 'Bearer', scopes: ['asset:read', 'design:meta:read'], expiresAt: 1_700_014_400_000 } }]);
assert.deepEqual(receipt, { provider: 'canva', ownerId: 'owner:1', scopes: ['asset:read', 'design:meta:read'], expiresAt: 1_700_014_400_000, rotated: true });
assert.equal(JSON.stringify(receipt).includes('new-access'), false);
assert.equal(JSON.stringify(receipt).includes('new-refresh'), false);
assert.equal(JSON.stringify(receipt).includes('client-secret'), false);

const keepScopes = [];
const noScopeResponse = createCanvaTokenRefresh({
  clientId: 'id', clientSecret: 'secret',
  tokenStore: {
    async load() { return { refreshToken: 'refresh', scopes: ['asset:read'] }; },
    async save(value) { keepScopes.push(value); }
  },
  fetchImpl: async () => ({ ok: true, async json() { return { access_token: 'access', refresh_token: 'refresh2', token_type: 'Bearer', expires_in: 3600 }; } })
});
await noScopeResponse.refresh({ ownerId: 'owner' });
assert.deepEqual(keepScopes[0].tokenRecord.scopes, ['asset:read']);

const missing = createCanvaTokenRefresh({
  clientId: 'id', clientSecret: 'secret', tokenStore: { async load() { return null; }, async save() {} },
  fetchImpl: async () => { throw new Error('must not fetch'); }
});
await assert.rejects(() => missing.refresh({ ownerId: 'owner' }), /CANVA_TOKEN_REFRESH_FAILED:missingRecord/);

const malformed = createCanvaTokenRefresh({
  clientId: 'id', clientSecret: 'secret', tokenStore: { async load() { return { refreshToken: '' }; }, async save() {} },
  fetchImpl: async () => { throw new Error('must not fetch'); }
});
await assert.rejects(() => malformed.refresh({ ownerId: 'owner' }), /INVALID_CANVA_TOKEN_REFRESH:refreshToken/);

for (const payload of [
  null,
  {},
  { access_token: 'a', refresh_token: 'r', token_type: 'MAC', expires_in: 3600 },
  { access_token: 'a', refresh_token: 'r', token_type: 'Bearer', expires_in: 1 },
  { access_token: 'a', refresh_token: '', token_type: 'Bearer', expires_in: 3600 }
]) {
  const bad = createCanvaTokenRefresh({
    clientId: 'id', clientSecret: 'secret', tokenStore: { async load() { return { refreshToken: 'refresh', scopes: [] }; }, async save() {} },
    fetchImpl: async () => ({ ok: true, async json() { return payload; } })
  });
  await assert.rejects(() => bad.refresh({ ownerId: 'owner' }), /CANVA_TOKEN_REFRESH_FAILED|INVALID_CANVA_TOKEN_REFRESH/);
}

const httpFailure = createCanvaTokenRefresh({
  clientId: 'id', clientSecret: 'secret', tokenStore: { async load() { return { refreshToken: 'refresh', scopes: [] }; }, async save() {} },
  fetchImpl: async () => ({ ok: false, async json() { return {}; } })
});
await assert.rejects(() => httpFailure.refresh({ ownerId: 'owner' }), /CANVA_TOKEN_REFRESH_FAILED:http/);
for (const input of [{}, { ownerId: '../owner' }, { ownerId: '' }]) await assert.rejects(() => runtime.refresh(input), /INVALID_CANVA_TOKEN_REFRESH/);
assert.throws(() => createCanvaTokenRefresh({ clientId: 'id', clientSecret: 'secret', tokenStore: { load() {} } }), /tokenStore/);
for (const input of [null, undefined, [], 'owner', 7]) {
  await assert.rejects(() => runtime.refresh(input), /INVALID_CANVA_TOKEN_REFRESH/);
}
console.log('canva token refresh tests passed');
