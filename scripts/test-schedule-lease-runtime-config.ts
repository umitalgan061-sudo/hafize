import assert from 'node:assert/strict';
import { createScheduleLeaseProviderRuntime, readScheduleLeaseRuntimeConfig, type ScheduleLeaseConfig } from '../lib/schedule-lease-runtime-config.ts';

const base = {
  HAFIZE_SCHEDULE_LEASE_PROVIDER: 'redis',
  HAFIZE_SCHEDULE_LEASE_HOLDER_ID: 'worker-a'
};

assert.equal(readScheduleLeaseRuntimeConfig({}), null);
assert.throws(() => readScheduleLeaseRuntimeConfig({ HAFIZE_SCHEDULE_LEASE_HOLDER_ID: 'worker-a' }), /INVALID_SCHEDULE_LEASE_CONFIG/);
assert.throws(() => readScheduleLeaseRuntimeConfig({ ...base, HAFIZE_SCHEDULE_LEASE_PROVIDER: 'Redis!' }), /INVALID_SCHEDULE_LEASE_CONFIG/);
assert.throws(() => readScheduleLeaseRuntimeConfig({ ...base, HAFIZE_SCHEDULE_LEASE_MS: '999' }), /INVALID_SCHEDULE_LEASE_CONFIG/);
assert.throws(() => readScheduleLeaseRuntimeConfig({ ...base, HAFIZE_SCHEDULE_LEASE_MS: '1000', HAFIZE_SCHEDULE_LEASE_RENEW_INTERVAL_MS: '1000' }), /INVALID_SCHEDULE_LEASE_CONFIG/);

const config: ScheduleLeaseConfig | null = readScheduleLeaseRuntimeConfig({
  ...base,
  HAFIZE_SCHEDULE_LEASE_MS: '30000',
  HAFIZE_SCHEDULE_LEASE_RENEW_INTERVAL_MS: '10000'
});
assert.deepEqual(config, { provider: 'redis', holderId: 'worker-a', leaseMs: 30000, renewIntervalMs: 10000 });
assert.ok(Object.isFrozen(config));

let factoryCalls = 0;
const disabled = await createScheduleLeaseProviderRuntime({
  env: {},
  providerFactories: { redis: () => { factoryCalls += 1; return {}; } }
});
assert.deepEqual(disabled, { configured: false, provider: null, lease: null, renewIntervalMs: null });
assert.equal(factoryCalls, 0);

await assert.rejects(
  createScheduleLeaseProviderRuntime({ env: base, providerFactories: {} }),
  /SCHEDULE_LEASE_PROVIDER_UNAVAILABLE/
);

let factoryInput: unknown;
let boundaryInput: unknown;
const adapter = { marker: true };
const lease = { acquire() {} };
const enabled = await createScheduleLeaseProviderRuntime({
  env: { ...base, HAFIZE_SCHEDULE_LEASE_MS: '45000', HAFIZE_SCHEDULE_LEASE_RENEW_INTERVAL_MS: '15000', REDIS_PASSWORD: 'must-not-cross-boundary' },
  providerFactories: {
    redis: (input) => { factoryInput = input; return adapter; }
  },
  createBoundary: (input) => { boundaryInput = input; return lease; }
});
assert.deepEqual(factoryInput, { provider: 'redis' });
assert.equal(JSON.stringify(factoryInput).includes('must-not-cross-boundary'), false);
assert.deepEqual(boundaryInput, { adapter, holderId: 'worker-a', leaseMs: 45000 });
assert.equal(enabled.configured, true);
assert.equal(enabled.provider, 'redis');
assert.equal(enabled.lease, lease);
assert.equal(enabled.renewIntervalMs, 15000);
assert.ok(Object.isFrozen(enabled));

await assert.rejects(
  createScheduleLeaseProviderRuntime({
    env: base,
    providerFactories: { redis: async () => { throw new Error('redis secret detail'); } },
    createBoundary: () => lease
  }),
  (error: unknown) => error instanceof Error && error.message === 'SCHEDULE_LEASE_RUNTIME_STARTUP_FAILED' && !error.message.includes('secret')
);
await assert.rejects(
  createScheduleLeaseProviderRuntime({
    env: base,
    providerFactories: { redis: async () => adapter },
    createBoundary: () => { throw new Error('internal detail'); }
  }),
  /SCHEDULE_LEASE_RUNTIME_STARTUP_FAILED/
);
console.log('schedule lease runtime config TypeScript tests passed');
