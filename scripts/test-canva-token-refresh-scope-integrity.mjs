import assert from 'node:assert/strict';
import { createCanvaTokenRefresh, CANVA_REFRESH_TOKEN_ENDPOINT } from '../lib/canva-token-refresh.mjs';

function currentRecord(scopes = ['profile:read', 'design:meta:read']) {
  return {
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    tokenType: 'Bearer',
    scopes,
    expiresAt: 1_700_000_100_000
  };
}

function refreshPayload(scope) {
  return {
    access_token: 'new-access',
    refresh_token: 'new-refresh',
    token_type: 'Bearer',
    expires_in: 3600,
    ...(scope === undefined ? {} : { scope })
  };
}

function harness({ previous = currentRecord(), response = refreshPayload('design:meta:read profile:read') } = {}) {
  const loads = [];
  const saves = [];
  const network = [];
  const tokenStore = {
    async load(input) {
      loads.push(input);
      return previous;
    },
    async save(input) { saves.push(input); }
  };
  const fetchImpl = async (url, init) => {
    network.push({ url, init });
    return { ok: true, async json() { return response; } };
  };
  const runtime = createCanvaTokenRefresh({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    tokenStore,
    fetchImpl,
    now: () => 1_700_000_000_000
  });
  return { runtime, loads, saves, network };
}

const exact = harness();
const result = await exact.runtime.refresh({ ownerId: 'owner:refresh' });
assert.deepEqual(exact.loads, [{ ownerId: 'owner:refresh', provider: 'canva' }]);
assert.equal(exact.network.length, 1);
assert.equal(exact.network[0].url, CANVA_REFRESH_TOKEN_ENDPOINT);
assert.equal(exact.network[0].init.method, 'POST');
assert.equal(exact.network[0].init.redirect, 'error');
assert.match(exact.network[0].init.headers.authorization, /^Basic /);
const body = new URLSearchParams(exact.network[0].init.body);
assert.equal(body.get('grant_type'), 'refresh_token');
assert.equal(body.get('refresh_token'), 'old-refresh');
assert.equal(exact.saves.length, 1);
assert.equal(exact.saves[0].ownerId, 'owner:refresh');
assert.equal(exact.saves[0].provider, 'canva');
assert.equal(exact.saves[0].tokenRecord.accessToken, 'new-access');
assert.equal(exact.saves[0].tokenRecord.refreshToken, 'new-refresh');
assert.deepEqual(exact.saves[0].tokenRecord.scopes, ['design:meta:read', 'profile:read']);
assert.equal(exact.saves[0].tokenRecord.expiresAt, 1_700_003_600_000);
assert.deepEqual(result.scopes, ['design:meta:read', 'profile:read']);
assert.equal(result.rotated, true);

const omittedScope = harness({ response: refreshPayload(undefined) });
await omittedScope.runtime.refresh({ ownerId: 'owner:omitted' });
assert.equal(omittedScope.saves.length, 1);
assert.deepEqual(omittedScope.saves[0].tokenRecord.scopes, ['design:meta:read', 'profile:read']);

for (const [name, returnedScope] of [
  ['missing', 'profile:read'],
  ['extra', 'profile:read design:meta:read asset:write'],
  ['different', 'profile:read asset:read'],
  ['duplicate', 'profile:read profile:read design:meta:read']
]) {
  const current = harness({ response: refreshPayload(returnedScope) });
  await assert.rejects(
    () => current.runtime.refresh({ ownerId: `owner:${name}` }),
    /CANVA_TOKEN_REFRESH_SCOPE_MISMATCH|INVALID_CANVA_TOKEN_REFRESH:responseScopes/
  );
  assert.equal(current.saves.length, 0, `${name} refresh scope must not overwrite token record`);
}

for (const badPrevious of [
  { ...currentRecord(), scopes: ['profile:read', 'profile:read'] },
  { ...currentRecord(), scopes: ['bad scope'] },
  { ...currentRecord(), scopes: Array.from({ length: 33 }, (_, index) => `scope:${index}`) },
  { ...currentRecord(), scopes: 'profile:read' }
]) {
  const current = harness({ previous: badPrevious });
  await assert.rejects(
    () => current.runtime.refresh({ ownerId: 'owner:bad-record' }),
    /INVALID_CANVA_TOKEN_REFRESH:previousScopes/
  );
  assert.equal(current.network.length, 0, 'invalid stored scope contract must fail before network');
  assert.equal(current.saves.length, 0);
}

const missingRecord = harness({ previous: null });
await assert.rejects(
  () => missingRecord.runtime.refresh({ ownerId: 'owner:missing' }),
  /CANVA_TOKEN_REFRESH_FAILED:missingRecord/
);
assert.equal(missingRecord.network.length, 0);
assert.equal(missingRecord.saves.length, 0);

const failedUpstream = createCanvaTokenRefresh({
  clientId: 'client-id',
  clientSecret: 'client-secret',
  tokenStore: {
    async load() { return currentRecord(); },
    async save() { assert.fail('failed upstream must not persist'); }
  },
  fetchImpl: async () => ({ ok: false, async json() { return {}; } })
});
await assert.rejects(
  () => failedUpstream.refresh({ ownerId: 'owner:http' }),
  /CANVA_TOKEN_REFRESH_FAILED:http/
);

const invalidOwner = harness();
await assert.rejects(
  () => invalidOwner.runtime.refresh({ ownerId: '../other-owner' }),
  /INVALID_CANVA_TOKEN_REFRESH:ownerId/
);
assert.equal(invalidOwner.loads.length, 0);
assert.equal(invalidOwner.network.length, 0);

console.log('Canva token refresh scope integrity tests passed');
