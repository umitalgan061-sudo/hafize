import assert from 'node:assert/strict';
import { createRedisScheduleLeaseRuntime } from '../lib/redis-schedule-lease-runtime.mjs';

function leaseEnv(overrides = {}) {
  return {
    HAFIZE_SCHEDULE_LEASE_PROVIDER: 'redis',
    HAFIZE_SCHEDULE_LEASE_HOLDER_ID: 'worker-a',
    HAFIZE_SCHEDULE_LEASE_MS: '60000',
    HAFIZE_SCHEDULE_LEASE_RENEW_INTERVAL_MS: '30000',
    HAFIZE_SCHEDULE_REDIS_URL: 'rediss://user:secret@example.test:6380',
    ...overrides
  };
}

let loads = 0;
const disabled = await createRedisScheduleLeaseRuntime({
  env: {},
  async loadRedisModule() {
    loads += 1;
    throw new Error('must not load');
  }
});
assert.equal(disabled.configured, false);
assert.equal(disabled.provider, null);
assert.equal(loads, 0);
await disabled.close();

await assert.rejects(
  createRedisScheduleLeaseRuntime({
    env: leaseEnv({ HAFIZE_SCHEDULE_LEASE_PROVIDER: 'postgres' }),
    async loadRedisModule() {
      loads += 1;
      return {};
    }
  }),
  /SCHEDULE_LEASE_PROVIDER_UNAVAILABLE/
);
assert.equal(loads, 0);

await assert.rejects(
  createRedisScheduleLeaseRuntime({
    env: leaseEnv({ HAFIZE_SCHEDULE_REDIS_URL: '' }),
    async loadRedisModule() {
      loads += 1;
      return {};
    }
  }),
  /SCHEDULE_LEASE_RUNTIME_STARTUP_FAILED/
);
assert.equal(loads, 0);

const calls = [];
let quitCalls = 0;
const fakeClient = {
  isOpen: false,
  isReady: false,
  async connect() {
    this.isOpen = true;
    this.isReady = true;
    calls.push('connect');
  },
  async eval(script, options) {
    calls.push({ script, options });
    return ['acquired', '7', '1786572000000'];
  },
  async quit() {
    quitCalls += 1;
    this.isOpen = false;
    this.isReady = false;
  }
};

let clientOptions = null;
const runtime = await createRedisScheduleLeaseRuntime({
  env: leaseEnv(),
  async loadRedisModule() {
    loads += 1;
    return {
      createClient(options) {
        clientOptions = options;
        return fakeClient;
      }
    };
  }
});
assert.equal(runtime.configured, true);
assert.equal(runtime.provider, 'redis');
assert.equal(runtime.renewIntervalMs, 30000);
assert.equal(Object.isFrozen(runtime), true);
assert.deepEqual(Object.keys(runtime).sort(), ['close', 'configured', 'lease', 'provider', 'renewIntervalMs'].sort());
assert.deepEqual(clientOptions, { url: 'rediss://user:secret@example.test:6380' });
assert.equal(JSON.stringify(runtime).includes('secret'), false);
assert.deepEqual(calls, ['connect']);

const acquired = await runtime.lease.acquire('schedule_42');
assert.equal(acquired.status, 'acquired');
assert.equal(acquired.fence, 7);
assert.equal(calls.length, 2);
assert.equal(calls[1].options.keys.every((key) => key.includes('{schedule_42}')), true);

await runtime.close();
await runtime.close();
assert.equal(quitCalls, 1);

let cleanupCalls = 0;
const cleanupClient = {
  isOpen: false,
  isReady: false,
  async connect() {
    this.isOpen = true;
    this.isReady = true;
  },
  async eval() {
    return ['completed'];
  },
  async quit() {
    cleanupCalls += 1;
    this.isOpen = false;
  }
};
await assert.rejects(
  createRedisScheduleLeaseRuntime({
    env: leaseEnv(),
    loadRedisModule: async () => ({ createClient: () => cleanupClient }),
    createAdapter() {
      throw new Error('rediss://user:secret@example.test:6380 adapter failure');
    }
  }),
  (error) => error.message === 'SCHEDULE_LEASE_RUNTIME_STARTUP_FAILED' && !error.message.includes('secret')
);
assert.equal(cleanupCalls, 1);

await assert.rejects(
  createRedisScheduleLeaseRuntime({
    env: leaseEnv(),
    async loadRedisModule() {
      throw new Error('rediss://user:secret@example.test:6380 import failure');
    }
  }),
  (error) => error.message === 'SCHEDULE_LEASE_RUNTIME_STARTUP_FAILED' && !error.message.includes('secret')
);

console.log('redis schedule lease runtime tests passed');
