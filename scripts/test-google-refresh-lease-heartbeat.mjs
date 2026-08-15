import assert from 'node:assert/strict';
import { createGoogleRefreshLease, GOOGLE_REFRESH_LEASE_LIMITS } from '../lib/google-refresh-lease.mjs';
import { createGoogleTokenRefresh } from '../lib/google-token-refresh.mjs';

const OWNER = 'owner_heartbeat';
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
let clock = 1_000;
let state = { key: null, value: null, expiry: 0 };
let nextTimer = 1;
const timers = new Map();

function expire() {
  if (state.key && state.expiry <= clock) state = { key: null, value: null, expiry: 0 };
}

function createClient() {
  return {
    isReady: false, isOpen: false, on() {},
    async connect() { this.isReady = this.isOpen = true; },
    async set(key, value, { NX, PX }) {
      expire();
      if (NX && state.key) return null;
      state = { key, value, expiry: clock + PX };
      return 'OK';
    },
    async eval(script, { keys, arguments: args }) {
      expire();
      if (keys[0] !== state.key || args[0] !== state.value) return 0;
      if (script.includes('PEXPIRE')) { state.expiry = clock + Number(args[1]); return 1; }
      state = { key: null, value: null, expiry: 0 };
      return 1;
    },
    async close() { this.isReady = this.isOpen = false; },
    destroy() { this.isReady = this.isOpen = false; }
  };
}

function setTimer(callback, ms) {
  const id = nextTimer++;
  timers.set(id, { at: clock + ms, callback });
  return id;
}

function clearTimer(id) { timers.delete(id); }

async function advanceTo(target) {
  while (true) {
    const due = [...timers.entries()]
      .filter(([, item]) => item.at <= target)
      .sort((a, b) => a[1].at - b[1].at)[0];
    if (!due) break;
    const [id, item] = due;
    timers.delete(id);
    clock = item.at;
    await item.callback();
  }
  clock = target;
  expire();
}

function runtime(extra = {}) {
  return createGoogleRefreshLease({
    redisUrl: 'redis://shared:6379/0', createClient, now: () => clock,
    randomBytesImpl: () => Buffer.alloc(16, 5), setTimer, clearTimer,
    sleep: async (ms) => { await advanceTo(clock + ms); }, ...extra
  });
}

const live = runtime();
const lease = await live.acquire({ ownerId: OWNER });
const firstExpiry = state.expiry;
await advanceTo(clock + GOOGLE_REFRESH_LEASE_LIMITS.heartbeatMs * 3 + 5);
assert.ok(state.expiry > firstExpiry, 'heartbeat must extend the lease');
assert.ok(state.expiry - clock >= GOOGLE_REFRESH_LEASE_LIMITS.leaseMs - 10, 'lease must remain near a full TTL');
assert.equal(timers.size, 1, 'heartbeat keeps exactly one future timer');
await lease.release();
assert.equal(state.key, null);
assert.equal(timers.size, 0, 'release must cancel heartbeat');
await live.close();

clock = 100_000;
state = { key: null, value: null, expiry: 0 };
timers.clear();
const crashed = createGoogleRefreshLease({
  redisUrl: 'redis://shared:6379/0', createClient, now: () => clock,
  randomBytesImpl: () => Buffer.alloc(16, 6),
  setTimer: () => 999, clearTimer: () => {}
});
await crashed.acquire({ ownerId: OWNER });
const waiter = runtime({ randomBytesImpl: () => Buffer.alloc(16, 7) });
const started = clock;
const recovered = await waiter.acquire({ ownerId: OWNER });
assert.ok(clock - started >= GOOGLE_REFRESH_LEASE_LIMITS.leaseMs, 'dead holder must be allowed to expire');
assert.ok(clock - started < GOOGLE_REFRESH_LEASE_LIMITS.waitMs, 'wait budget must cover one dead-holder TTL');
await recovered.release();
await Promise.all([crashed.close(), waiter.close()]);

let renews = 0;
let saves = 0;
let nowCalls = 0;
const refresh = createGoogleTokenRefresh({
  clientId: 'google-client-id.apps.example',
  now: () => [200_000, 207_500][Math.min(nowCalls++, 1)],
  tokenStore: {
    async load() {
      return { accessToken: 'expired-access', refreshToken: 'refresh-token-12345678', tokenType: 'Bearer', scopes: [SCOPE], expiresAt: 1 };
    },
    async save({ tokenRecord }) {
      saves += 1;
      assert.equal(tokenRecord.expiresAt, 207_500 + 3_600_000);
    }
  },
  refreshLease: {
    async acquire() { return { async renew() { renews += 1; }, async release() {} }; },
    async close() {}
  },
  fetchImpl: async () => ({
    ok: true,
    async json() { return { access_token: 'fresh-access-token-123456789', token_type: 'Bearer', expires_in: 3600, scope: SCOPE }; }
  })
});
const result = await refresh.refresh({ ownerId: OWNER });
assert.equal(result.expiresAt, 207_500 + 3_600_000, 'expiry must start when provider response is received');
assert.equal(renews, 2, 'ownership is verified immediately before and after token-store mutation');
assert.equal(saves, 1);

console.log('Google refresh lease heartbeat tests passed');
