import assert from 'node:assert/strict';
import { createCanvaReadClient, CANVA_READ_OPERATIONS } from '../lib/canva-read-client.mjs';

const future = 2_000_000_000_000;
const accessToken = 'canva_access_token_1234567890';
const calls = [];
let record = { accessToken, tokenType: 'Bearer', scopes: ['profile:read', 'design:meta:read'], expiresAt: future + 120_000 };
const tokenStore = { async load(input) { calls.push(['load', input]); return record; } };
const fetchImpl = async (url, options) => {
  calls.push(['fetch', url, options]);
  return { ok: true, async json() { return { ok: true, url }; } };
};
const client = createCanvaReadClient({ tokenStore, fetchImpl, now: () => future });

assert.deepEqual(CANVA_READ_OPERATIONS, ['user.get', 'user.profile', 'user.capabilities', 'design.list', 'design.get']);
let result = await client.read({ ownerId: 'owner:1', operation: 'user.get' });
assert.equal(result.ok, true);
assert.deepEqual(calls[0], ['load', { ownerId: 'owner:1', provider: 'canva' }]);
assert.equal(calls[1][1], 'https://api.canva.com/rest/v1/users/me');
assert.equal(calls[1][2].method, 'GET');
assert.equal(calls[1][2].headers.authorization, `Bearer ${accessToken}`);
assert.equal(JSON.stringify(result).includes(accessToken), false);

calls.length = 0;
await client.read({ ownerId: 'owner:1', operation: 'user.profile' });
assert.equal(calls[1][1], 'https://api.canva.com/rest/v1/users/me/profile');
calls.length = 0;
await client.read({ ownerId: 'owner:1', operation: 'user.capabilities' });
assert.equal(calls[1][1], 'https://api.canva.com/rest/v1/users/me/capabilities');

calls.length = 0;
await client.read({ ownerId: 'owner:1', operation: 'design.list', params: { query: 'annual report', ownership: 'owned', sortBy: 'modified_descending', limit: 20, continuation: 'next-token' } });
const listUrl = new URL(calls[1][1]);
assert.equal(listUrl.origin, 'https://api.canva.com');
assert.equal(listUrl.pathname, '/rest/v1/designs');
assert.equal(listUrl.searchParams.get('query'), 'annual report');
assert.equal(listUrl.searchParams.get('ownership'), 'owned');
assert.equal(listUrl.searchParams.get('sort_by'), 'modified_descending');
assert.equal(listUrl.searchParams.get('limit'), '20');
assert.equal(listUrl.searchParams.get('continuation'), 'next-token');

calls.length = 0;
await client.read({ ownerId: 'owner:1', operation: 'design.get', params: { designId: 'DAF_abc-123' } });
assert.equal(calls[1][1], 'https://api.canva.com/rest/v1/designs/DAF_abc-123');

record = { ...record, scopes: [] };
await assert.rejects(() => client.read({ ownerId: 'owner:1', operation: 'user.profile' }), /CANVA_READ_SCOPE_REQUIRED:profile:read/);
await assert.rejects(() => client.read({ ownerId: 'owner:1', operation: 'design.list' }), /CANVA_READ_SCOPE_REQUIRED:design:meta:read/);
record = { ...record, scopes: ['design:meta:read'], expiresAt: future + 29_000 };
await assert.rejects(() => client.read({ ownerId: 'owner:1', operation: 'user.get' }), /CANVA_READ_REAUTH_REQUIRED/);
record = { ...record, expiresAt: future + 120_000 };

for (const input of [
  null,
  undefined,
  'user.get',
  ['user.get'],
  {},
  { ownerId: '../bad', operation: 'user.get' },
  { ownerId: 'owner', operation: 'design.delete' },
  { ownerId: 'owner', operation: 'design.list', params: { limit: 101 } },
  { ownerId: 'owner', operation: 'design.list', params: { ownership: 'all' } },
  { ownerId: 'owner', operation: 'design.list', params: { extra: true } },
  { ownerId: 'owner', operation: 'design.get', params: { designId: '../secret' } }
]) await assert.rejects(() => client.read(input), /INVALID_CANVA_READ/);

const echoClient = createCanvaReadClient({ tokenStore, now: () => future, fetchImpl: async () => ({ ok: true, async json() { return { leaked: accessToken }; } }) });
await assert.rejects(() => echoClient.read({ ownerId: 'owner', operation: 'user.get' }), /CANVA_READ_FAILED:response/);
const hugeClient = createCanvaReadClient({ tokenStore, now: () => future, maxJsonBytes: 1024, fetchImpl: async () => ({ ok: true, async json() { return { data: 'x'.repeat(1200) }; } }) });
await assert.rejects(() => hugeClient.read({ ownerId: 'owner', operation: 'user.get' }), /CANVA_READ_FAILED:response/);
const httpClient = createCanvaReadClient({ tokenStore, now: () => future, fetchImpl: async () => ({ ok: false, status: 401, async json() { return {}; } }) });
await assert.rejects(() => httpClient.read({ ownerId: 'owner', operation: 'user.get' }), /CANVA_READ_FAILED:http/);

assert.throws(() => createCanvaReadClient({}), /INVALID_CANVA_READ:tokenStore/);
assert.throws(() => createCanvaReadClient({ tokenStore, fetchImpl: null }), /INVALID_CANVA_READ:fetch/);
console.log('canva read client tests passed');
