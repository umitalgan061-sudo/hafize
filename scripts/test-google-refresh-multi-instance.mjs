import assert from 'node:assert/strict';
import { createGoogleTokenRefresh } from '../lib/google-token-refresh.mjs';

const OWNER = 'owner_multi_instance';
const READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
let record = {
  accessToken: 'expired-access-token-0000000000',
  refreshToken: 'refresh-token-original-0000000000',
  tokenType: 'Bearer',
  scopes: [READ_SCOPE],
  expiresAt: 1
};
let saves = 0;
const store = {
  async load({ ownerId, provider }) {
    assert.equal(ownerId, OWNER);
    assert.equal(provider, 'google');
    return structuredClone(record);
  },
  async save({ ownerId, provider, tokenRecord }) {
    assert.equal(ownerId, OWNER);
    assert.equal(provider, 'google');
    saves += 1;
    record = structuredClone(tokenRecord);
  }
};

let held = false;
const waiters = [];
let acquireCalls = 0;
let releaseCalls = 0;
let renewCalls = 0;
function sharedLeaseRuntime() {
  return {
    async acquire({ ownerId }) {
      assert.equal(ownerId, OWNER);
      acquireCalls += 1;
      if (held) await new Promise((resolve) => waiters.push(resolve));
      held = true;
      let released = false;
      return {
        async renew() {
          assert.equal(held, true);
          renewCalls += 1;
        },
        async release() {
          if (released) return;
          released = true;
          held = false;
          releaseCalls += 1;
          waiters.shift()?.();
        }
      };
    },
    async close() {}
  };
}

let providerStarted;
const providerStartedPromise = new Promise((resolve) => { providerStarted = resolve; });
let resolveProvider;
const providerGate = new Promise((resolve) => { resolveProvider = resolve; });
let providerCalls = 0;
const first = createGoogleTokenRefresh({
  clientId: 'google-client-id.apps.example',
  tokenStore: store,
  refreshLease: sharedLeaseRuntime(),
  now: () => 10_000,
  async fetchImpl() {
    providerCalls += 1;
    providerStarted();
    await providerGate;
    return {
      ok: true,
      async json() {
        return {
          access_token: 'fresh-access-token-111111111111',
          refresh_token: 'rotated-refresh-token-1111111111',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: READ_SCOPE
        };
      }
    };
  }
});
const second = createGoogleTokenRefresh({
  clientId: 'google-client-id.apps.example',
  tokenStore: store,
  refreshLease: sharedLeaseRuntime(),
  now: () => 10_000,
  async fetchImpl() {
    providerCalls += 1;
    throw new Error('second instance must reuse the refreshed store record');
  }
});

const firstRun = first.refresh({ ownerId: OWNER });
await providerStartedPromise;
const secondRun = second.refresh({ ownerId: OWNER });
await Promise.resolve();
assert.equal(acquireCalls, 2);
assert.equal(providerCalls, 1);
resolveProvider();
const [firstResult, secondResult] = await Promise.all([firstRun, secondRun]);

assert.equal(providerCalls, 1, 'two processes must produce one Google refresh request');
assert.equal(saves, 1, 'fresh record from the first holder must not be overwritten');
assert.equal(record.refreshToken, 'rotated-refresh-token-1111111111');
assert.equal(record.accessToken, 'fresh-access-token-111111111111');
assert.equal(renewCalls, 1, 'provider result must renew ownership before token mutation');
assert.equal(releaseCalls, 2);
assert.equal(firstResult.expiresAt, secondResult.expiresAt);
assert.deepEqual(firstResult.scopes, [READ_SCOPE]);
assert.deepEqual(secondResult.scopes, [READ_SCOPE]);
assert.equal(JSON.stringify(secondResult).includes(record.accessToken), false);
assert.equal(JSON.stringify(secondResult).includes(record.refreshToken), false);

let lostSaves = 0;
const lost = createGoogleTokenRefresh({
  clientId: 'google-client-id.apps.example',
  tokenStore: {
    async load() { return { ...record, accessToken: 'expired-again-222222222222', expiresAt: 1 }; },
    async save() { lostSaves += 1; }
  },
  refreshLease: {
    async acquire() {
      return {
        async renew() { const error = new Error('GOOGLE_REFRESH_LEASE_LOST'); error.code = error.message; throw error; },
        async release() {}
      };
    },
    async close() {}
  },
  now: () => 20_000,
  fetchImpl: async () => ({
    ok: true,
    async json() { return { access_token: 'must-not-save-333333333333', token_type: 'Bearer', expires_in: 3600, scope: READ_SCOPE }; }
  })
});
await assert.rejects(
  () => lost.refresh({ ownerId: OWNER }),
  (error) => error?.code === 'GOOGLE_REFRESH_LEASE_LOST'
);
assert.equal(lostSaves, 0, 'lost distributed ownership must fail before encrypted token mutation');

console.log('Google refresh multi-instance tests passed');
