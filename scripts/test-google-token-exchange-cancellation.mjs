import assert from 'node:assert/strict';
import { createGoogleTokenExchange } from '../lib/google-token-exchange.mjs';

const OWNER = 'owner_google_exchange';
const REDIRECT = 'https://hafize.example.test/api/connectors/gmail/oauth/callback';
const CODE = 'authorization-code-123';
const VERIFIER = 'v'.repeat(64);
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

function tokenPayload(overrides = {}) {
  return {
    access_token: 'access-token-123',
    refresh_token: 'refresh-token-123',
    token_type: 'Bearer',
    expires_in: 3600,
    scope: SCOPE,
    ...overrides
  };
}

function createStore() {
  const calls = { saves: [], loads: [] };
  return {
    calls,
    store: {
      async save(input) { calls.saves.push(input); },
      async load(input) { calls.loads.push(input); return null; }
    }
  };
}

function createExchange({ fetchImpl, store, now = () => 1_800_000_000_000 } = {}) {
  return createGoogleTokenExchange({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    tokenStore: store,
    fetchImpl,
    now,
    requestTimeoutMs: 10_000
  });
}

function input(signal = null) {
  return {
    ownerId: OWNER,
    code: CODE,
    verifier: VERIFIER,
    redirectUri: REDIRECT,
    expectedScopes: [SCOPE],
    requireRefreshToken: true,
    signal
  };
}

{
  const outer = new AbortController();
  outer.abort('caller-left');
  const { store, calls } = createStore();
  let fetchCalls = 0;
  const exchange = createExchange({
    store,
    fetchImpl: async () => { fetchCalls += 1; throw new Error('must not fetch'); }
  });
  await assert.rejects(
    exchange.exchange(input(outer.signal)),
    (error) => error?.code === 'GOOGLE_TOKEN_EXCHANGE_FAILED:cancelled'
  );
  assert.equal(fetchCalls, 0);
  assert.equal(calls.saves.length, 0, 'pre-abort must not persist credentials');
  assert.equal(calls.loads.length, 0);
}

{
  const outer = new AbortController();
  const { store, calls } = createStore();
  let providerSignal = null;
  const exchange = createExchange({
    store,
    fetchImpl: async (_url, init) => {
      providerSignal = init.signal;
      return await new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      });
    }
  });
  const pending = exchange.exchange(input(outer.signal));
  await Promise.resolve();
  outer.abort('navigation');
  await assert.rejects(pending, (error) => error?.code === 'GOOGLE_TOKEN_EXCHANGE_FAILED:cancelled');
  assert.equal(providerSignal?.aborted, true);
  assert.equal(calls.saves.length, 0, 'cancelled provider exchange must not persist credentials');
}

{
  const outer = new AbortController();
  const { store, calls } = createStore();
  const exchange = createExchange({
    store,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get() { return null; } },
      async json() {
        outer.abort('cancel-after-provider-response');
        return tokenPayload();
      }
    })
  });
  await assert.rejects(
    exchange.exchange(input(outer.signal)),
    (error) => error?.code === 'GOOGLE_TOKEN_EXCHANGE_FAILED:cancelled'
  );
  assert.equal(calls.saves.length, 0, 'late cancellation before persistence must win');
}

{
  const outer = new AbortController();
  const calls = { saves: [], loads: [] };
  let loadStarted;
  const loadGate = new Promise((resolve) => { loadStarted = resolve; });
  let finishLoad;
  const loadResult = new Promise((resolve) => { finishLoad = resolve; });
  const store = {
    async save(value) { calls.saves.push(value); },
    async load(value) {
      calls.loads.push(value);
      loadStarted();
      return loadResult;
    }
  };
  const exchange = createExchange({
    store,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get() { return null; } },
      async json() { return tokenPayload({ refresh_token: undefined }); }
    })
  });
  const pending = exchange.exchange({ ...input(outer.signal), requireRefreshToken: false });
  await loadGate;
  outer.abort('cancel-during-fallback-load');
  finishLoad({ refreshToken: 'old-refresh-token' });
  await assert.rejects(pending, (error) => error?.code === 'GOOGLE_TOKEN_EXCHANGE_FAILED:cancelled');
  assert.equal(calls.loads.length, 1);
  assert.equal(calls.saves.length, 0, 'cancellation during fallback refresh-token load blocks save');
}

{
  const { store, calls } = createStore();
  let receivedSignal = null;
  const exchange = createExchange({
    store,
    fetchImpl: async (_url, init) => {
      receivedSignal = init.signal;
      return {
        ok: true,
        status: 200,
        headers: { get() { return null; } },
        async json() { return tokenPayload(); }
      };
    }
  });
  const outer = new AbortController();
  const result = await exchange.exchange(input(outer.signal));
  assert.equal(receivedSignal instanceof AbortSignal, true);
  assert.equal(result.provider, 'google');
  assert.equal(result.ownerId, OWNER);
  assert.equal(result.refreshTokenStored, true);
  assert.equal(calls.saves.length, 1);
  assert.equal(calls.saves[0].ownerId, OWNER);
  assert.equal(calls.saves[0].provider, 'google');
  assert.equal(calls.saves[0].tokenRecord.refreshToken, 'refresh-token-123');
}

console.log('Google token exchange cancellation tests passed');
