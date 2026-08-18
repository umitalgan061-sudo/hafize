import assert from 'node:assert/strict';
import {
  createRedisScheduleLeaseAdapter,
  REDIS_SCHEDULE_COMPLETION_TTL_LIMITS
} from '../lib/redis-schedule-lease-adapter.mjs';

const calls = [];
const redis = {
  async eval(script, input) {
    calls.push({ script, input });
    if (script.includes('hafize:complete')) return ['completed'];
    throw new Error('unexpected script');
  }
};
const ttl = 2 * 24 * 60 * 60_000;
const adapter = createRedisScheduleLeaseAdapter({ redis, completionTtlMs: ttl });
const result = await adapter.complete({
  scheduleId: 'schedule-1',
  holderId: 'worker-1',
  fence: 3,
  idempotencyKey: 'trace-1'
});
assert.deepEqual(result, { status: 'completed' });
assert.equal(calls.length, 1);
assert.equal(calls[0].script.includes("redis.call('SET', KEYS[3], ARGV[3], 'PX', ARGV[4])"), true);
assert.deepEqual(calls[0].input.arguments, ['worker-1', '3', 'trace-1', String(ttl)]);
assert.equal(calls[0].input.keys[2], 'hafize:schedule-lease:{schedule-1}:completed');

for (const invalid of [0, 999, REDIS_SCHEDULE_COMPLETION_TTL_LIMITS.minMs - 1, REDIS_SCHEDULE_COMPLETION_TTL_LIMITS.maxMs + 1, 1.5, '3600000']) {
  assert.throws(
    () => createRedisScheduleLeaseAdapter({ redis, completionTtlMs: invalid }),
    /INVALID_REDIS_SCHEDULE_LEASE:completionTtlMs/
  );
}
console.log('redis schedule completion tombstone ttl ok');
