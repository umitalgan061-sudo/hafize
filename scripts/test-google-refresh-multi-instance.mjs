import assert from 'node:assert/strict';
import { createGoogleTokenRefresh } from '../lib/google-token-refresh.mjs';

const OWNER = 'owner_multi_instance';
const READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
let record = { accessToken: 'expired-access-token-0000000000', refreshToken: 'refresh-token-original-0000000000', tokenType: 'Bearer', scopes: [READ_SCOPE], expiresAt: 1 };
let saves = 0;
const store = {
  async load() { return structuredClone(record); },
  async save({ tokenRecord }) { saves += 1; record = structuredClone(tokenRecord); }
};

let held = false;
const waiters = [];
let acquireCalls = 0;
let releaseCalls = 0;
let renewCalls = 0;
function sharedLeaseRuntime() {
  return {
    async acquire({ ownerId }) {
      assert.equal(ownerId, OWNER); acquireCalls += 1;
      if (held) await new Promise((resolve) => waiters.push(resolve));
      held = true;
      let released = false;
      return {
        async renew() { assert.equal(held, true); renewCalls += 1; },
        async release() {
          if (released) return;
          released = true; held = false; releaseCalls += 1; waiters.shift()?.();
        }
      };
    },
    async close() {}
  };
}

let providerStarted;
const started = new Promise((resolve) => { providerStarted = resolve; });
let resolveProvider;
const gate = new Promise((resolve) => { resolveProvider = resolve; });
let providerCalls = 0;
const first = createGoogleTokenRefresh({
  clientId: 'google-client-id.apps.example', tokenStore: store, refreshLease: sharedLeaseRuntime(), now: () => 10_000,
  async fetchImpl() {
    providerCalls += 1; providerStarted(); await gate;
    return { ok: true, async json() { return { access_token: 'fresh-access-token-111111111111', refresh_token: 'rotated-refresh-token-1111111111', token_type: 'Bearer', expires_in: 3600, scope: READ_SCOPE }; } };
  }
});
const second = createGoogleTokenRefresh({
  clientId: 'google-client-id.apps.example', tokenStore: store, refreshLease: sharedLeaseRuntime(), now: () => 10_000,
  async fetchImpl() { providerCalls += 1; throw new Error('duplicate provider refresh'); }
});

const firstRun = first.refresh({ ownerId: OWNER });
await started;
const secondRun = second.refresh({ ownerId: OWNER });
await Promise.resolve();
assert.equal(acquireCalls, 2); assert.equal(providerCalls, 1);
resolveProvider();
const [one, two] = await Promise.all([firstRun, secondRun]);
assert.equal(providerCalls, 1, 'two instances must produce one Google refresh');
assert.equal(saves, 1, 'second holder must reuse the fresh encrypted record');
assert.equal(record.refreshToken, 'rotated-refresh-token-1111111111');
assert.equal(renewCalls, 2); assert.equal(releaseCalls, 2);
assert.equal(one.expiresAt, two.expiresAt);
assert.equal(JSON.stringify(two).includes(record.accessToken), false);
assert.equal(JSON.stringify(two).includes(record.refreshToken), false);

let lostSaves = 0;
const lost = createGoogleTokenRefresh({
  clientId: 'google-client-id.apps.example', now: () => 20_000,
  tokenStore: { async load() { return { ...record, expiresAt: 1 }; }, async save() { lostSaves += 1; } },
  refreshLease: {
    async acquire() { return { async renew() { const error = new Error('GOOGLE_REFRESH_LEASE_LOST'); error.code = error.message; throw error; }, async release() {} }; },
    async close() {}
  },
  fetchImpl: async () => ({ ok: true, async json() { return { access_token: 'must-not-save-333333333333', token_type: 'Bearer', expires_in: 3600, scope: READ_SCOPE }; } })
});
await assert.rejects(() => lost.refresh({ ownerId: OWNER }), (error) => error?.code === 'GOOGLE_REFRESH_LEASE_LOST');
assert.equal(lostSaves, 0, 'lost lease must fail before token mutation');

let postSaveRecord = { ...record, expiresAt: 1 };
let postSaveSaves = 0;
let postSaveRenews = 0;
let postSaveProviderCalls = 0;
const postSaveLost = createGoogleTokenRefresh({
  clientId: 'google-client-id.apps.example', now: () => 30_000,
  tokenStore: {
    async load() { return structuredClone(postSaveRecord); },
    async save({ tokenRecord }) { postSaveSaves += 1; postSaveRecord = structuredClone(tokenRecord); }
  },
  refreshLease: {
    async acquire() {
      return {
        async renew() {
          postSaveRenews += 1;
          if (postSaveRenews === 2) { const error = new Error('GOOGLE_REFRESH_LEASE_LOST'); error.code = error.message; throw error; }
        },
        async release() {}
      };
    },
    async close() {}
  },
  fetchImpl: async () => {
    postSaveProviderCalls += 1;
    return { ok: true, async json() { return { access_token: 'post-save-fresh-token-44444444', token_type: 'Bearer', expires_in: 3600, scope: READ_SCOPE }; } };
  }
});
await assert.rejects(() => postSaveLost.refresh({ ownerId: OWNER }), (error) => error?.code === 'GOOGLE_REFRESH_LEASE_LOST');
assert.equal(postSaveSaves, 1, 'post-save ownership loss is reported only after the encrypted record was persisted');

const retryAfterPostSaveLoss = createGoogleTokenRefresh({
  clientId: 'google-client-id.apps.example', now: () => 31_000,
  tokenStore: {
    async load() { return structuredClone(postSaveRecord); },
    async save() { throw new Error('fresh record must not be rewritten'); }
  },
  refreshLease: {
    async acquire() { return { async renew() { throw new Error('fresh record must not renew'); }, async release() {} }; },
    async close() {}
  },
  fetchImpl: async () => { postSaveProviderCalls += 1; throw new Error('fresh record must not hit provider'); }
});
const retried = await retryAfterPostSaveLoss.refresh({ ownerId: OWNER });
assert.equal(postSaveProviderCalls, 1, 'retry must reuse the fresh persisted record without a second provider refresh');
assert.equal(postSaveSaves, 1);
assert.equal(retried.expiresAt, postSaveRecord.expiresAt);

let backwardSaves = 0;
let backwardNowCalls = 0;
const backwardClock = createGoogleTokenRefresh({
  clientId: 'google-client-id.apps.example',
  now: () => [50_000, 49_999][Math.min(backwardNowCalls++, 1)],
  tokenStore: {
    async load() { return { ...record, expiresAt: 1 }; },
    async save() { backwardSaves += 1; }
  },
  fetchImpl: async () => ({ ok: true, async json() { return { access_token: 'clock-test-token-555555555555', token_type: 'Bearer', expires_in: 3600, scope: READ_SCOPE }; } })
});
await assert.rejects(() => backwardClock.refresh({ ownerId: OWNER }), (error) => error?.code === 'INVALID_GOOGLE_TOKEN_REFRESH:now');
assert.equal(backwardSaves, 0, 'backward provider-completion clock must fail before token mutation');

console.log('Google refresh multi-instance tests passed');
