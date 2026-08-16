import assert from 'node:assert/strict';
import { createCanvaTokenExchange, CANVA_TOKEN_ENDPOINT } from '../lib/canva-token-exchange.mjs';

function tokenPayload(scope = 'profile:read design:meta:read') {
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    token_type: 'Bearer',
    expires_in: 3600,
    scope
  };
}

function harness(payload = tokenPayload()) {
  const fetchCalls = [];
  const saves = [];
  const tokenStore = {
    async save(input) { saves.push(input); }
  };
  const fetchImpl = async (url, init) => {
    fetchCalls.push({ url, init });
    return { ok: true, async json() { return payload; } };
  };
  const exchange = createCanvaTokenExchange({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    tokenStore,
    fetchImpl,
    now: () => 1_700_000_000_000
  });
  return { exchange, fetchCalls, saves };
}

const exact = harness();
const result = await exact.exchange.exchange({
  ownerId: 'owner:123',
  code: 'authorization-code',
  verifier: 'v'.repeat(64),
  redirectUri: 'https://hafize.example/api/connectors/canva/oauth/callback',
  expectedScopes: ['design:meta:read', 'profile:read']
});
assert.equal(exact.fetchCalls.length, 1);
assert.equal(exact.fetchCalls[0].url, CANVA_TOKEN_ENDPOINT);
assert.equal(exact.fetchCalls[0].init.method, 'POST');
assert.equal(exact.fetchCalls[0].init.redirect, 'error');
assert.match(exact.fetchCalls[0].init.headers.authorization, /^Basic /);
assert.equal(exact.fetchCalls[0].init.headers['content-type'], 'application/x-www-form-urlencoded');
const body = new URLSearchParams(exact.fetchCalls[0].init.body);
assert.equal(body.get('grant_type'), 'authorization_code');
assert.equal(body.get('code'), 'authorization-code');
assert.equal(body.get('code_verifier'), 'v'.repeat(64));
assert.equal(body.get('redirect_uri'), 'https://hafize.example/api/connectors/canva/oauth/callback');
assert.equal(exact.saves.length, 1);
assert.equal(exact.saves[0].ownerId, 'owner:123');
assert.equal(exact.saves[0].provider, 'canva');
assert.deepEqual(exact.saves[0].tokenRecord.scopes, ['design:meta:read', 'profile:read']);
assert.equal(exact.saves[0].tokenRecord.expiresAt, 1_700_003_600_000);
assert.deepEqual(result.scopes, ['design:meta:read', 'profile:read']);
assert.equal(result.refreshTokenStored, true);

const reordered = harness(tokenPayload('design:meta:read profile:read'));
await reordered.exchange.exchange({
  ownerId: 'owner:sorted',
  code: 'authorization-code',
  verifier: 'v'.repeat(64),
  redirectUri: 'https://hafize.example/api/connectors/canva/oauth/callback',
  expectedScopes: ['profile:read', 'design:meta:read']
});
assert.equal(reordered.saves.length, 1, 'scope order must not change authorization meaning');

for (const [label, scope, expectedScopes] of [
  ['missing', 'profile:read', ['profile:read', 'design:meta:read']],
  ['extra', 'profile:read design:meta:read asset:read', ['profile:read', 'design:meta:read']],
  ['empty', '', ['profile:read']],
  ['unexpected-only', 'asset:read', ['profile:read']]
]) {
  const current = harness(tokenPayload(scope));
  await assert.rejects(
    () => current.exchange.exchange({
      ownerId: `owner:${label}`,
      code: 'authorization-code',
      verifier: 'v'.repeat(64),
      redirectUri: 'https://hafize.example/api/connectors/canva/oauth/callback',
      expectedScopes
    }),
    /CANVA_TOKEN_EXCHANGE_SCOPE_MISMATCH|INVALID_CANVA_TOKEN_EXCHANGE:scope/
  );
  assert.equal(current.saves.length, 0, `${label} scope response must never be persisted`);
}

const duplicateResponse = harness(tokenPayload('profile:read profile:read'));
await assert.rejects(
  () => duplicateResponse.exchange.exchange({
    ownerId: 'owner:duplicate-response',
    code: 'authorization-code',
    verifier: 'v'.repeat(64),
    redirectUri: 'https://hafize.example/api/connectors/canva/oauth/callback',
    expectedScopes: ['profile:read']
  }),
  /INVALID_CANVA_TOKEN_EXCHANGE:responseScopes/
);
assert.equal(duplicateResponse.saves.length, 0);

for (const invalidExpected of [
  ['profile:read', 'profile:read'],
  ['bad scope'],
  [':bad'],
  Array.from({ length: 33 }, (_, index) => `scope:${index}`),
  'profile:read'
]) {
  const current = harness();
  await assert.rejects(
    () => current.exchange.exchange({
      ownerId: 'owner:invalid-expected',
      code: 'authorization-code',
      verifier: 'v'.repeat(64),
      redirectUri: 'https://hafize.example/api/connectors/canva/oauth/callback',
      expectedScopes: invalidExpected
    }),
    /INVALID_CANVA_TOKEN_EXCHANGE:expectedScopes/
  );
  assert.equal(current.fetchCalls.length, 0, 'invalid expected scope contract must fail before network');
  assert.equal(current.saves.length, 0);
}

const legacy = harness(tokenPayload('asset:read'));
await legacy.exchange.exchange({
  ownerId: 'owner:legacy',
  code: 'authorization-code',
  verifier: 'v'.repeat(64),
  redirectUri: 'https://hafize.example/api/connectors/canva/oauth/callback'
});
assert.equal(legacy.saves.length, 1, 'existing explicit callers without expectedScopes keep legacy compatibility');

const failedUpstream = createCanvaTokenExchange({
  clientId: 'client-id',
  clientSecret: 'client-secret',
  tokenStore: { async save() { assert.fail('failed upstream must not save'); } },
  fetchImpl: async () => ({ ok: false, async json() { return {}; } })
});
await assert.rejects(
  () => failedUpstream.exchange({
    ownerId: 'owner:http',
    code: 'authorization-code',
    verifier: 'v'.repeat(64),
    redirectUri: 'https://hafize.example/api/connectors/canva/oauth/callback',
    expectedScopes: ['profile:read']
  }),
  /CANVA_TOKEN_EXCHANGE_FAILED:http/
);

console.log('Canva token scope integrity tests passed');
