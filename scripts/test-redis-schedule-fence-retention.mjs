import assert from 'node:assert/strict';
import { createRedisScheduleLeaseAdapter } from '../lib/redis-schedule-lease-adapter.mjs';

const ttl = 2 * 24 * 60 * 60_000;
const calls = [];
const responses = [
  ['acquired', '4', String(Date.parse('2026-08-18T04:01:00.000Z'))],
  ['renewed', String(Date.parse('2026-08-18T04:02:00.000Z'))],
  ['completed'],
  ['released']
];
const redis = {
  async eval(script, input) {
    calls.push({ script, input });
    return responses.shift();
  }
};
const adapter = createRedisScheduleLeaseAdapter({ redis, completionTtlMs: ttl });

await adapter.acquire({ scheduleId: 's1', holderId: 'w1', leaseMs: 60_000 });
await adapter.renew({ scheduleId: 's1', holderId: 'w1', fence: 4, leaseMs: 60_000 });
await adapter.complete({ scheduleId: 's1', holderId: 'w1', fence: 4, idempotencyKey: 'trace-1' });
await adapter.release({ scheduleId: 's2', holderId: 'w1', fence: 5 });

assert.equal(calls.length, 4);
assert.equal(calls[0].script.includes("redis.call('PEXPIRE', KEYS[2], ARGV[3])"), true);
assert.deepEqual(calls[0].input.arguments, ['w1', '60000', String(ttl)]);
assert.equal(calls[1].script.includes("redis.call('PEXPIRE', KEYS[2], ARGV[4])"), true);
assert.deepEqual(calls[1].input.arguments, ['w1', '4', '60000', String(ttl)]);
assert.equal(calls[2].script.includes("redis.call('PEXPIRE', KEYS[2], ARGV[4])"), true);
assert.deepEqual(calls[2].input.arguments, ['w1', '4', 'trace-1', String(ttl)]);
assert.equal(calls[3].script.includes("redis.call('PEXPIRE', KEYS[2], ARGV[3])"), true);
assert.deepEqual(calls[3].input.arguments, ['w1', '5', String(ttl)]);
for (const call of calls) assert.equal(call.input.keys[1].endsWith(':fence'), true);
console.log('redis schedule fence retention ok');
