import assert from 'node:assert/strict';
import { createCanvaTokenExchange, CANVA_TOKEN_ENDPOINT } from '../lib/canva-token-exchange.mjs';
import { createCanvaTokenRefresh } from '../lib/canva-token-refresh.mjs';
import { createCanvaTokenRevoke, CANVA_REVOKE_ENDPOINT } from '../lib/canva-token-revoke.mjs';

const OWNER = 'owner-1';
const SECRET = 'secret';
const CLIENT = 'client';
const REDIRECT = 'https://hafize.example/api/connectors/canva/oauth/callback';
const VERIFIER = 'v'.repeat(43);
const TOKEN_RESPONSE = Object.freeze({
  access_token: 'access-token', refresh_token: 'refresh-token', token_type: 'Bearer', expires_in: 3600,
  scope: 'asset:read profile:read'
});

function jsonResponse(payload = TOKEN_RESPONSE) {
  return { ok: true, status: 200, async json() { return payload; } };
}

{
  const saved = [];
  const calls = [];
  const exchange = createCanvaTokenExchange({
    clientId: CLIENT, clientSecret: SECRET, now: () => 1_800_000_000_000,
    tokenStore: { async save(value) { saved.push(value); } },
    fetchImpl: async (url, options) => { calls.push({ url, options }); return jsonResponse(); }
  });
  const result = await exchange.exchange({
    ownerId: OWNER, code: 'authorization-code', verifier: VERIFIER, redirectUri: REDIRECT,
    expectedScopes: ['profile:read', 'asset:read']
  });
  assert.equal(calls[0].url, CANVA_TOKEN_ENDPOINT);
  assert.equal(calls[0].options.redirect, 'error');
  assert.ok(calls[0].options.signal);
  assert.match(calls[0].options.headers.authorization, /^Basic /);
  assert.equal(result.refreshTokenStored, true);
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0].tokenRecord.scopes, ['asset:read', 'profile:read']);
}

{
  let saved = false;
  const exchange = createCanvaTokenExchange({
    clientId: CLIENT, clientSecret: SECRET,
    tokenStore: { async save() { saved = true; } },
    fetchImpl: async () => jsonResponse({ ...TOKEN_RESPONSE, scope: 'asset:write profile:read' })
  });
  await assert.rejects(exchange.exchange({
    ownerId: OWNER, code: 'authorization-code', verifier: VERIFIER, redirectUri: REDIRECT,
    expectedScopes: ['asset:read', 'profile:read']
  }), /CANVA_TOKEN_EXCHANGE_SCOPE_MISMATCH/);
  assert.equal(saved, false, 'scope escalation never reaches persistence');
}

{
  let saveCount = 0;
  let timeoutCallback;
  const exchange = createCanvaTokenExchange({
    clientId: CLIENT, clientSecret: SECRET, timeoutMs: 5,
    tokenStore: { async save() { saveCount += 1; } },
    fetchImpl: async (_url, options) => await new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => { const error = new Error('aborted'); error.name = 'AbortError'; reject(error); }, { once: true });
    }),
    setTimeoutImpl(callback) { timeoutCallback = callback; return 1; },
    clearTimeoutImpl() {}
  });
  const pending = exchange.exchange({ ownerId: OWNER, code: 'authorization-code', verifier: VERIFIER, redirectUri: REDIRECT, expectedScopes: [] });
  await Promise.resolve();
  timeoutCallback();
  await assert.rejects(pending, /CANVA_TOKEN_EXCHANGE_FAILED:timeout/);
  assert.equal(saveCount, 0);
}

{
  const saved = [];
  const current = { refreshToken: 'old-refresh', scopes: ['asset:read', 'profile:read'] };
  const refresh = createCanvaTokenRefresh({
    clientId: CLIENT, clientSecret: SECRET, now: () => 1_800_000_000_000,
    tokenStore: { async load() { return current; }, async save(value) { saved.push(value); } },
    fetchImpl: async () => jsonResponse({ ...TOKEN_RESPONSE, refresh_token: 'rotated-refresh' })
  });
  const result = await refresh.refresh({ ownerId: OWNER });
  assert.equal(result.rotated, true);
  assert.equal(saved[0].tokenRecord.refreshToken, 'rotated-refresh');
}

{
  let saved = false;
  const refresh = createCanvaTokenRefresh({
    clientId: CLIENT, clientSecret: SECRET,
    tokenStore: {
      async load() { return { refreshToken: 'old-refresh', scopes: ['asset:read'] }; },
      async save() { saved = true; }
    },
    fetchImpl: async () => jsonResponse({ ...TOKEN_RESPONSE, scope: 'asset:read profile:read' })
  });
  await assert.rejects(refresh.refresh({ ownerId: OWNER }), /CANVA_TOKEN_REFRESH_SCOPE_MISMATCH/);
  assert.equal(saved, false);
}

{
  let fetched = 0;
  let removed = 0;
  const revoke = createCanvaTokenRevoke({
    clientId: CLIENT, clientSecret: SECRET,
    tokenStore: {
      async load() { return { refreshToken: 'refresh-token' }; },
      async remove() { removed += 1; return { deleted: true }; }
    },
    fetchImpl: async (url, options) => {
      fetched += 1;
      assert.equal(url, CANVA_REVOKE_ENDPOINT);
      assert.equal(options.redirect, 'error');
      return { ok: true, status: 200, body: { async cancel() {} } };
    }
  });
  await assert.rejects(revoke.revoke({ ownerId: OWNER }), /CANVA_TOKEN_REVOKE_REQUIRES_INTENT/);
  assert.equal(fetched, 0, 'missing explicit intent blocks upstream side effect');
  const result = await revoke.revoke({ ownerId: OWNER, explicitUserIntent: true });
  assert.equal(result.revoked, true);
  assert.equal(fetched, 1);
  assert.equal(removed, 1, 'local token is deleted only after upstream revoke succeeds');
}

{
  let removed = 0;
  const revoke = createCanvaTokenRevoke({
    clientId: CLIENT, clientSecret: SECRET,
    tokenStore: { async load() { return { refreshToken: 'refresh-token' }; }, async remove() { removed += 1; } },
    fetchImpl: async () => ({ ok: false, status: 503, body: { async cancel() {} } })
  });
  await assert.rejects(revoke.revoke({ ownerId: OWNER, explicitUserIntent: true }), /CANVA_TOKEN_REVOKE_FAILED:http/);
  assert.equal(removed, 0, 'failed upstream revoke preserves local token for safe retry/recovery');
}

console.log('canva token lifecycle boundary tests passed');
