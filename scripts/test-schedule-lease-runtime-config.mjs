import assert from 'node:assert/strict';
import {
  createScheduleLeaseProviderRuntime,
  readScheduleLeaseRuntimeConfig
} from '../lib/schedule-lease-runtime-config.mjs';

assert.equal(readScheduleLeaseRuntimeConfig({}), null);
assert.throws(
  () => readScheduleLeaseRuntimeConfig({ HAFIZE_SCHEDULE_LEASE_HOLDER_ID: 'worker-a' }),
  /INVALID_SCHEDULE_LEASE_CONFIG/
);
assert.throws(
  () => readScheduleLeaseRuntimeConfig({
    HAFIZE_SCHEDULE_LEASE_PROVIDER: 'Redis!',
    HAFIZE_SCHEDULE_LEASE_HOLDER_ID: 'worker-a'
  }),
  /INVALID_SCHEDULE_LEASE_CONFIG/
);
assert.throws(
  () => readScheduleLeaseRuntimeConfig({
    HAFIZE_SCHEDULE_LEASE_PROVIDER: 'redis',
    HAFIZE_SCHEDULE_LEASE_HOLDER_ID: 'worker-a',
    HAFIZE_SCHEDULE_LEASE_MS: '999'
  }),
  /INVALID_SCHEDULE_LEASE_CONFIG/
);
assert.throws(
  () => readScheduleLeaseRuntimeConfig({
    HAFIZE_SCHEDULE_LEASE_PROVIDER: 'redis',
    HAFIZE_SCHEDULE_LEASE_HOLDER_ID: 'worker-a',
    HAFIZE_SCHEDULE_LEASE_MS: '1000',
    HAFIZE_SCHEDULE_LEASE_RENEW_INTERVAL_MS: '1000'
  }),
  /INVALID_SCHEDULE_LEASE_CONFIG/
);

const config = readScheduleLeaseRuntimeConfig({
  HAFIZE_SCHEDULE_LEASE_PROVIDER: 'redis',
  HAFIZE_SCHEDULE_LEASE_HOLDER_ID: 'worker-a',
  HAFIZE_SCHEDULE_LEASE_MS: '30000',
  HAFIZE_SCHEDULE_LEASE_RENEW_INTERVAL_MS: '10000'
});
assert.deepEqual(config, {
  provider: 'redis',
  holderId: 'worker-a',
  leaseMs: 30000,
  renewIntervalMs: 10000
});
assert.equal(Object.isFrozen(config), true);

let factoryCalls = 0;
const disabled = await createScheduleLeaseProviderRuntime({
  env: {},
  providerFactories: {
    redis() {
      factoryCalls += 1;
      return {};
    }
  }
});
assert.deepEqual(disabled, {
  configured: false,
  provider: null,
  lease: null,
  renewIntervalMs: null
});
assert.equal(factoryCalls, 0);
assert.equal(Object.isFrozen(disabled), true);

await assert.rejects(
  createScheduleLeaseProviderRuntime({
    env: {
      HAFIZE_SCHEDULE_LEASE_PROVIDER: 'redis',
      HAFIZE_SCHEDULE_LEASE_HOLDER_ID: 'worker-a'
    }
  }),
  /SCHEDULE_LEASE_PROVIDER_UNAVAILABLE/
);

let receivedFactoryInput;
let receivedBoundaryInput;
const adapter = { marker: true };
const lease = { acquire() {} };
const enabled = await createScheduleLeaseProviderRuntime({
  env: {
    HAFIZE_SCHEDULE_LEASE_PROVIDER: 'redis',
    HAFIZE_SCHEDULE_LEASE_HOLDER_ID: 'worker-a',
    HAFIZE_SCHEDULE_LEASE_MS: '45000',
    HAFIZE_SCHEDULE_LEASE_RENEW_INTERVAL_MS: '15000',
    REDIS_PASSWORD: 'must-not-enter-factory-input'
  },
  providerFactories: {
    redis(input) {
      receivedFactoryInput = input;
      return adapter;
    }
  },
  createBoundary(input) {
    receivedBoundaryInput = input;
    return lease;
  }
});
assert.deepEqual(receivedFactoryInput, { provider: 'redis' });
assert.equal(JSON.stringify(receivedFactoryInput).includes('must-not-enter-factory-input'), false);
assert.deepEqual(receivedBoundaryInput, { adapter, holderId: 'worker-a', leaseMs: 45000 });
assert.equal(enabled.configured, true);
assert.equal(enabled.provider, 'redis');
assert.equal(enabled.lease, lease);
assert.equal(enabled.renewIntervalMs, 15000);
assert.equal(Object.isFrozen(enabled), true);

await assert.rejects(
  createScheduleLeaseProviderRuntime({
    env: {
      HAFIZE_SCHEDULE_LEASE_PROVIDER: 'redis',
      HAFIZE_SCHEDULE_LEASE_HOLDER_ID: 'worker-a'
    },
    providerFactories: {
      redis: async () => {
        throw new Error('redis://user:secret@example');
      }
    },
    createBoundary() {
      return lease;
    }
  }),
  (error) => error.message === 'SCHEDULE_LEASE_RUNTIME_STARTUP_FAILED' && !error.message.includes('secret')
);

await assert.rejects(
  createScheduleLeaseProviderRuntime({
    env: {
      HAFIZE_SCHEDULE_LEASE_PROVIDER: 'redis',
      HAFIZE_SCHEDULE_LEASE_HOLDER_ID: 'worker-a'
    },
    providerFactories: { redis: async () => adapter },
    createBoundary() {
      throw new Error('internal adapter detail');
    }
  }),
  (error) => error.message === 'SCHEDULE_LEASE_RUNTIME_STARTUP_FAILED'
);

console.log('schedule lease runtime config tests passed');
