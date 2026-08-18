import assert from 'node:assert/strict';
import {
  readScheduleLeaseRuntimeConfig,
  SCHEDULE_LEASE_COMPLETION_TTL_LIMITS
} from '../lib/schedule-lease-runtime-config.mjs';

const baseEnv = {
  HAFIZE_SCHEDULE_LEASE_PROVIDER: 'redis',
  HAFIZE_SCHEDULE_LEASE_HOLDER_ID: 'worker-1'
};

const defaults = readScheduleLeaseRuntimeConfig(baseEnv);
assert.equal(defaults.completionTtlMs, 7 * 24 * 60 * 60_000);
assert.equal(defaults.completionTtlMs, SCHEDULE_LEASE_COMPLETION_TTL_LIMITS.defaultMs);

const minimum = readScheduleLeaseRuntimeConfig({
  ...baseEnv,
  HAFIZE_SCHEDULE_LEASE_COMPLETION_TTL_MS: String(SCHEDULE_LEASE_COMPLETION_TTL_LIMITS.minMs)
});
assert.equal(minimum.completionTtlMs, 60 * 60_000);

const maximum = readScheduleLeaseRuntimeConfig({
  ...baseEnv,
  HAFIZE_SCHEDULE_LEASE_COMPLETION_TTL_MS: String(SCHEDULE_LEASE_COMPLETION_TTL_LIMITS.maxMs)
});
assert.equal(maximum.completionTtlMs, 30 * 24 * 60 * 60_000);

for (const invalid of [
  '0',
  '999',
  String(SCHEDULE_LEASE_COMPLETION_TTL_LIMITS.minMs - 1),
  String(SCHEDULE_LEASE_COMPLETION_TTL_LIMITS.maxMs + 1),
  '-1',
  '1.5',
  'NaN',
  ' 1000x '
]) {
  assert.throws(
    () => readScheduleLeaseRuntimeConfig({ ...baseEnv, HAFIZE_SCHEDULE_LEASE_COMPLETION_TTL_MS: invalid }),
    /INVALID_SCHEDULE_LEASE_CONFIG/
  );
}

assert.throws(
  () => readScheduleLeaseRuntimeConfig({ HAFIZE_SCHEDULE_LEASE_COMPLETION_TTL_MS: String(60 * 60_000) }),
  /INVALID_SCHEDULE_LEASE_CONFIG/
);
console.log('schedule lease completion ttl config ok');
