import assert from 'node:assert/strict';
import { GOOGLE_REFRESH_LEASE_LIMITS, createGoogleRefreshLease } from '../lib/google-refresh-lease.mjs';

const OWNER = 'owner_refresh_lease';
let clock = 1_000;
let key = null;
let value = null;
let expiry = 0;
let createCalls = 0;
let closeCalls = 0;
let firstLease = null;
let sleepCalls = 0;
let clientOptions = null;

function createClient(options) {
  createCalls += 1;
  clientOptions = options;
  return {
    isReady: false,
    isOpen: false,
    on() {},
    async connect() { this.isReady = true; this.isOpen = true; },
    async set(nextKey, nextValue, { NX, PX }) {
      if (expiry <= clock) { key = null; value = null; }
      if (NX && key) return null;
      key = nextKey;
      value = nextValue;
      expiry = clock + PX;
      return 'OK';
    },
    async eval(script, { keys, arguments: args }) {
      assert.equal(keys[0], key);
      if (script.includes('PEXPIRE')) {
        if (value !== args[0]) return 0;
        expiry = clock + Number(args[1]);
        return 1;
      }
      if (script.includes("redis.call('DEL'")) {
        if (value !== args[0]) return 0;
        key = null;
        value = null;
        expiry = 0;
        return 1;
      }
      throw new Error('unexpected script');
    },
    async close() { closeCalls += 1; this.isReady = false; this.isOpen = false; },
    destroy() { this.isReady = false; this.isOpen = false; }
  };
}

const lease = createGoogleRefreshLease({
  redisUrl: 'rediss://user:password@redis.example.test:6380/0',
  createClient,
  now: () => clock,
  randomBytesImpl: () => Buffer.alloc(16, 7),
  async sleep(ms) {
    sleepCalls += 1;
    clock += ms;
    if (sleepCalls === 1) await firstLease.release();
  }
});

assert.equal(createCalls, 0, 'Redis must remain lazy before the first refresh');
firstLease = await lease.acquire({ ownerId: OWNER });
assert.equal(createCalls, 1);
assert.equal(clientOptions.url.includes('password'), true, 'credential may reach only the Redis client factory');
assert.deepEqual(clientOptions.socket, {
  connectTimeout: GOOGLE_REFRESH_LEASE_LIMITS.connectTimeoutMs,
  reconnectStrategy: false
});
assert.match(key, /^hafize:google-refresh:v1:[a-f0-9]{64}$/);
assert.equal(key.includes(OWNER), false, 'owner id must not appear in Redis keys');
assert.equal(value.length, 22);
assert.equal(expiry, clock + GOOGLE_REFRESH_LEASE_LIMITS.leaseMs);

await firstLease.renew();
assert.equal(expiry, clock + GOOGLE_REFRESH_LEASE_LIMITS.leaseMs);

const secondLease = await lease.acquire({ ownerId: OWNER });
assert.equal(sleepCalls, 1, 'busy contender must wait instead of bypassing the lease');
assert.equal(createCalls, 1, 'one runtime reuses one Redis client');
await secondLease.release();
assert.equal(key, null);
await secondLease.release();
assert.equal(key, null, 'release must be idempotent');

const closeA = lease.close();
const closeB = lease.close();
assert.strictEqual(closeA, closeB, 'runtime close must share one promise');
await closeA;
assert.equal(closeCalls, 1);
await assert.rejects(
  () => lease.acquire({ ownerId: OWNER }),
  (error) => error?.code === 'GOOGLE_REFRESH_LEASE_UNAVAILABLE'
);
assert.equal(createCalls, 1, 'closed runtime must never reconnect');

let busyClock = 0;
let busySetCalls = 0;
const alwaysBusy = createGoogleRefreshLease({
  redisUrl: 'redis://shared:6379/0',
  now: () => busyClock,
  randomBytesImpl: () => Buffer.alloc(16, 8),
  sleep: async (ms) => { busyClock += ms; },
  createClient: () => ({
    isReady: false,
    isOpen: false,
    on() {},
    async connect() { this.isReady = true; this.isOpen = true; },
    async set() { busySetCalls += 1; return null; },
    async eval() { throw new Error('eval must not run'); },
    async close() { this.isReady = false; this.isOpen = false; }
  })
});
await assert.rejects(
  () => alwaysBusy.acquire({ ownerId: OWNER }),
  (error) => error?.code === 'GOOGLE_REFRESH_LEASE_BUSY'
);
assert.equal(busyClock, GOOGLE_REFRESH_LEASE_LIMITS.waitMs);
assert.equal(busySetCalls > 1, true);
await alwaysBusy.close();

console.log('Google refresh distributed lease tests passed');
