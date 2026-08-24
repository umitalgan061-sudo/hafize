import assert from 'node:assert/strict';
import { createGoogleTokenRefresh, GOOGLE_REFRESH_TOKEN_ENDPOINT } from '../lib/google-token-refresh.mjs';

const READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const OWNER = 'owner_refresh_test';
const originalRefreshToken = 'refresh-token-original-1234567890';

function createStore(record) {
  let current = structuredClone(record);
  const saves = [];
  return {
    saves,
    async load({ ownerId, provider }) {
      assert.equal(ownerId, OWNER);
      assert.equal(provider, 'google');
      return current ? structuredClone(current) : null;
    },
    async save({ ownerId, provider, tokenRecord }) {
      assert.equal(ownerId, OWNER);
      assert.equal(provider, 'google');
      current = structuredClone(tokenRecord);
      saves.push(structuredClone(tokenRecord));
    },
    current: () => structuredClone(current)
  };
}

const store = createStore({
  accessToken: 'expired-access-token-0000000000',
  refreshToken: originalRefreshToken,
  tokenType: 'Bearer',
  scopes: [READ_SCOPE],
  expiresAt: 1
});
let fetchCalls = 0;
const refresh = createGoogleTokenRefresh({
  clientId: 'google-client-id.apps.example',
  clientSecret: 'server-held-client-secret',
  tokenStore: store,
  now: () => 10_000,
  async fetchImpl(url, init) {
    fetchCalls += 1;
    assert.equal(url, GOOGLE_REFRESH_TOKEN_ENDPOINT);
    assert.equal(init.method, 'POST');
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers['content-type'], 'application/x-www-form-urlencoded');
    const body = new URLSearchParams(init.body);
    assert.equal(body.get('grant_type'), 'refresh_token');
    assert.equal(body.get('client_id'), 'google-client-id.apps.example');
    assert.equal(body.get('client_secret'), 'server-held-client-secret');
    assert.equal(body.get('refresh_token'), originalRefreshToken);
    return {
      ok: true,
      async json() {
        return { access_token: 'fresh-access-token-111111111111', token_type: 'Bearer', expires_in: 3600 };
      }
    };
  }
});

const [first, second] = await Promise.all([
  refresh.refresh({ ownerId: OWNER }),
  refresh.refresh({ ownerId: OWNER })
]);
assert.equal(fetchCalls, 1, 'concurrent refreshes for one owner must share one provider request');
assert.deepEqual(first, second);
assert.deepEqual(first.scopes, [READ_SCOPE]);
assert.equal(first.expiresAt, 3_610_000);
assert.equal(Object.hasOwn(first, 'accessToken'), false);
assert.equal(Object.hasOwn(first, 'refreshToken'), false);
assert.equal(store.saves.length, 1);
assert.equal(store.current().accessToken, 'fresh-access-token-111111111111');
assert.equal(store.current().refreshToken, originalRefreshToken, 'Google may omit refresh_token; existing token must survive');
assert.deepEqual(store.current().scopes, [READ_SCOPE]);

const rotateStore = createStore({
  accessToken: 'expired-access-token-2222222222',
  refreshToken: originalRefreshToken,
  tokenType: 'Bearer',
  scopes: [READ_SCOPE],
  expiresAt: 1
});
const rotate = createGoogleTokenRefresh({
  clientId: 'public-client-id',
  tokenStore: rotateStore,
  now: () => 20_000,
  fetchImpl: async () => ({
    ok: true,
    async json() {
      return {
        access_token: 'fresh-access-token-333333333333',
        refresh_token: 'rotated-refresh-token-4444444444',
        token_type: 'bearer',
        expires_in: 1800,
        scope: READ_SCOPE
      };
    }
  })
});
await rotate.refresh({ ownerId: OWNER });
assert.equal(rotateStore.current().refreshToken, 'rotated-refresh-token-4444444444');
assert.equal(rotateStore.current().expiresAt, 1_820_000);

const escalationStore = createStore({
  accessToken: 'expired-access-token-5555555555',
  refreshToken: originalRefreshToken,
  tokenType: 'Bearer',
  scopes: [READ_SCOPE],
  expiresAt: 1
});
const escalation = createGoogleTokenRefresh({
  clientId: 'public-client-id',
  tokenStore: escalationStore,
  fetchImpl: async () => ({
    ok: true,
    async json() {
      return {
        access_token: 'fresh-access-token-666666666666',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: `${READ_SCOPE} https://www.googleapis.com/auth/gmail.send`
      };
    }
  })
});
await assert.rejects(
  () => escalation.refresh({ ownerId: OWNER }),
  (error) => error?.code === 'GOOGLE_TOKEN_REFRESH_SCOPE_ESCALATION'
);
assert.equal(escalationStore.saves.length, 0, 'provider scope escalation must never overwrite stored authorization');

const missingRefreshStore = createStore({
  accessToken: 'expired-access-token-7777777777',
  refreshToken: null,
  tokenType: 'Bearer',
  scopes: [READ_SCOPE],
  expiresAt: 1
});
let missingFetchCalls = 0;
const missing = createGoogleTokenRefresh({
  clientId: 'public-client-id',
  tokenStore: missingRefreshStore,
  fetchImpl: async () => { missingFetchCalls += 1; throw new Error('network must not run'); }
});
await assert.rejects(() => missing.refresh({ ownerId: OWNER }), /INVALID_GOOGLE_TOKEN_REFRESH:refreshToken/);
assert.equal(missingFetchCalls, 0);

for (const input of [null, []]) {
  assert.throws(
    () => refresh.refresh(input),
    (error) => error?.code === 'INVALID_GOOGLE_TOKEN_REFRESH:input'
  );
}

console.log('google token refresh security tests passed');