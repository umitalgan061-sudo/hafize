import assert from 'node:assert/strict';
import { createCanvaReadClient } from '../lib/canva-read-client.mjs';

function validRecord(scopes = ['profile:read']) {
  return {
    accessToken: 'access-token-1234567890',
    refreshToken: 'refresh-token',
    tokenType: 'Bearer',
    scopes,
    expiresAt: 1_800_000_000_000
  };
}

function clientFor(record) {
  const network = [];
  const client = createCanvaReadClient({
    tokenStore: { async load() { return record; } },
    now: () => 1_700_000_000_000,
    fetchImpl: async (url, init) => {
      network.push({ url, init });
      return { ok: true, async json() { return { ok: true }; } };
    }
  });
  return { client, network };
}

const valid = clientFor(validRecord());
assert.deepEqual(await valid.client.read({ ownerId: 'owner:read', operation: 'user.profile' }), { ok: true });
assert.equal(valid.network.length, 1);
assert.equal(valid.network[0].url, 'https://api.canva.com/rest/v1/users/me/profile');
assert.equal(valid.network[0].init.redirect, 'error');

for (const [name, scopes] of [
  ['duplicate', ['profile:read', 'profile:read']],
  ['space', ['profile:read', 'bad scope']],
  ['leading-symbol', [':bad']],
  ['too-many', Array.from({ length: 33 }, (_, index) => `scope:${index}`)]
]) {
  const current = clientFor(validRecord(scopes));
  await assert.rejects(
    () => current.client.read({ ownerId: `owner:${name}`, operation: 'user.get' }),
    /INVALID_CANVA_READ:token\.scope|INVALID_CANVA_READ:token\.scopes/
  );
  assert.equal(current.network.length, 0, `${name} stored scope record must fail before Canva network`);
}

const missingProfile = clientFor(validRecord(['design:meta:read']));
await assert.rejects(
  () => missingProfile.client.read({ ownerId: 'owner:no-profile', operation: 'user.profile' }),
  /CANVA_READ_SCOPE_REQUIRED:profile:read/
);
assert.equal(missingProfile.network.length, 0);

const design = clientFor(validRecord(['design:meta:read']));
await design.client.read({ ownerId: 'owner:design', operation: 'design.list', params: { limit: 5 } });
assert.equal(design.network.length, 1);
assert.equal(design.network[0].url, 'https://api.canva.com/rest/v1/designs?limit=5');

const noScopes = clientFor({ ...validRecord(), scopes: null });
await assert.rejects(
  () => noScopes.client.read({ ownerId: 'owner:no-scopes', operation: 'user.get' }),
  /INVALID_CANVA_READ:token\.scopes/
);
assert.equal(noScopes.network.length, 0);

console.log('Canva read token scope boundary tests passed');
