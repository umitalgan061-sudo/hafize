import assert from 'node:assert/strict';
import { GOOGLE_REFRESH_LEASE_LIMITS, createGoogleRefreshLease } from '../lib/google-refresh-lease.mjs';

const OWNER = 'owner_refresh_lease';
let clock = 1_000;
let state = { key: null, value: null, expiry: 0 };
let createCalls = 0;
let closeCalls = 0;
let sleepCalls = 0;
let firstLease;
let options;

function createClient(input) {
  createCalls += 1;
  options = input;
  return {
    isReady: false, isOpen: false, on() {},
    async connect() { this.isReady = this.isOpen = true; },
    async set(key, value, { NX, PX }) {
      if (state.expiry <= clock) state = { key: null, value: null, expiry: 0 };
      if (NX && state.key) return null;
      state = { key, value, expiry: clock + PX };
      return 'OK';
    },
    async eval(script, { keys, arguments: args }) {
      assert.equal(keys[0], state.key);
      if (state.value !== args[0]) return 0;
      if (script.includes('PEXPIRE')) { state.expiry = clock + Number(args[1]); return 1; }
      state = { key: null, value: null, expiry: 0 };
      return 1;
    },
    async close() { closeCalls += 1; this.isReady = this.isOpen = false; },
    destroy() { this.isReady = this.isOpen = false; }
  };
}

const runtime = createGoogleRefreshLease({
  redisUrl: 'rediss://user:password@redis.example.test:6380/0', createClient,
  now: () => clock, randomBytesImpl: () => Buffer.alloc(16, 7),
  async sleep(ms) { sleepCalls += 1; clock += ms; if (sleepCalls === 1) await firstLease.release(); }
});
assert.equal(createCalls, 0);
firstLease = await runtime.acquire({ ownerId: OWNER });
assert.equal(createCalls, 1);
assert.deepEqual(options.socket, { connectTimeout: GOOGLE_REFRESH_LEASE_LIMITS.connectTimeoutMs, reconnectStrategy: false });
assert.match(state.key, /^hafize:google-refresh:v1:[a-f0-9]{64}$/);
assert.equal(state.key.includes(OWNER), false);
assert.equal(state.value.length, 22);
await firstLease.renew();
assert.equal(state.expiry, clock + GOOGLE_REFRESH_LEASE_LIMITS.leaseMs);

const secondLease = await runtime.acquire({ ownerId: OWNER });
assert.equal(sleepCalls, 1, 'busy owner must wait for the current holder');
assert.equal(createCalls, 1);
await secondLease.release();
await secondLease.release();
assert.equal(state.key, null);

const closeA = runtime.close();
const closeB = runtime.close();
assert.strictEqual(closeA, closeB);
await closeA;
assert.equal(closeCalls, 1);
await assert.rejects(() => runtime.acquire({ ownerId: OWNER }), (error) => error?.code === 'GOOGLE_REFRESH_LEASE_UNAVAILABLE');
assert.equal(createCalls, 1, 'closed runtime must never reconnect');
console.log('Google refresh distributed lease tests passed');
