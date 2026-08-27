import assert from 'node:assert/strict';
import { CANVA_REVOKE_ENDPOINT, createCanvaTokenRevoke } from '../lib/canva-token-revoke.mjs';

const loads = [];
const removes = [];
const requests = [];
const runtime = createCanvaTokenRevoke({
  clientId: 'client-id',
  clientSecret: 'client-secret',
  tokenStore: {
    async load(input) { loads.push(input); return { refreshToken: 'refresh-token' }; },
    async remove(input) { removes.push(input); return { deleted: true }; }
  },
  fetchImpl: async (url, init) => { requests.push({ url, init }); return { ok: true }; }
});

await assert.rejects(() => runtime.revoke({ ownerId: 'owner:1' }), /CANVA_TOKEN_REVOKE_REQUIRES_INTENT/);
assert.equal(loads.length, 0);
const receipt = await runtime.revoke({ ownerId: 'owner:1', explicitUserIntent: true });
assert.deepEqual(loads, [{ ownerId: 'owner:1', provider: 'canva' }]);
assert.equal(requests[0].url, CANVA_REVOKE_ENDPOINT);
assert.equal(requests[0].init.method, 'POST');
assert.equal(requests[0].init.redirect, 'error');
assert.equal(requests[0].init.headers.authorization, `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`);
assert.deepEqual(Object.fromEntries(new URLSearchParams(requests[0].init.body)), { token: 'refresh-token' });
assert.deepEqual(removes, [{ ownerId: 'owner:1', provider: 'canva', explicitUserIntent: true }]);
assert.deepEqual(receipt, { provider: 'canva', ownerId: 'owner:1', revoked: true, localTokenDeleted: true });
assert.equal(JSON.stringify(receipt).includes('refresh-token'), false);
assert.equal(JSON.stringify(receipt).includes('client-secret'), false);

const missing = createCanvaTokenRevoke({ clientId: 'id', clientSecret: 'secret', tokenStore: { async load() { return null; }, async remove() {} }, fetchImpl: async () => { throw new Error('must not fetch'); } });
await assert.rejects(() => missing.revoke({ ownerId: 'owner', explicitUserIntent: true }), /CANVA_TOKEN_REVOKE_FAILED:missingRecord/);
const httpFailureRemoves = [];
const httpFailure = createCanvaTokenRevoke({
  clientId: 'id', clientSecret: 'secret',
  tokenStore: { async load() { return { refreshToken: 'refresh' }; }, async remove(value) { httpFailureRemoves.push(value); } },
  fetchImpl: async () => ({ ok: false })
});
await assert.rejects(() => httpFailure.revoke({ ownerId: 'owner', explicitUserIntent: true }), /CANVA_TOKEN_REVOKE_FAILED:http/);
assert.equal(httpFailureRemoves.length, 0);
for (const input of [
  { ownerId: '../owner', explicitUserIntent: true },
  { ownerId: '', explicitUserIntent: true },
  null,
  undefined,
  'owner',
  ['owner'],
  42
]) await assert.rejects(() => runtime.revoke(input), /INVALID_CANVA_TOKEN_REVOKE/);
assert.throws(() => createCanvaTokenRevoke({ clientId: 'id', clientSecret: 'secret', tokenStore: { load() {} } }), /tokenStore/);
console.log('canva token revoke tests passed');
