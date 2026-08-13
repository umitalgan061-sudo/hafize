import assert from 'node:assert/strict';
import { createScheduleExecutionLeaseBoundary } from '../lib/schedule-execution-lease.mjs';
import { createRedisScheduleLeaseAdapter } from '../lib/redis-schedule-lease-adapter.mjs';

class FakeRedis {
  constructor() {
    this.calls = [];
    this.responses = new Map();
  }

  push(operation, response) {
    const queue = this.responses.get(operation) || [];
    queue.push(response);
    this.responses.set(operation, queue);
  }

  async eval(script, options) {
    const operation = /^-- hafize:([a-z]+)/.exec(script)?.[1];
    if (!operation) throw new Error('missing operation marker');
    this.calls.push({ operation, script, options });
    const queue = this.responses.get(operation) || [];
    if (!queue.length) throw new Error(`missing fake response:${operation}`);
    const response = queue.shift();
    if (response instanceof Error) throw response;
    return response;
  }
}

const redis = new FakeRedis();
const adapter = createRedisScheduleLeaseAdapter({ redis, keyPrefix: 'hafize:test-lease' });
const lease = createScheduleExecutionLeaseBoundary({ adapter, holderId: 'worker-a', leaseMs: 30_000 });

redis.push('acquire', ['acquired', '7', '1786591200000']);
const acquired = await lease.acquire('schedule_1');
assert.equal(acquired.status, 'acquired');
assert.equal(acquired.fence, 7);
assert.equal(acquired.expiresAt, '2026-08-13T03:20:00.000Z');
assert.equal(acquired.idempotencyKey, 'schedule-execution:schedule_1');

const acquireCall = redis.calls.at(-1);
assert.deepEqual(acquireCall.options.keys, [
  'hafize:test-lease:{schedule_1}:lease',
  'hafize:test-lease:{schedule_1}:fence',
  'hafize:test-lease:{schedule_1}:completed'
]);
assert.deepEqual(acquireCall.options.arguments, ['worker-a', '30000']);
assert.equal(acquireCall.script.includes("redis.call('TIME')"), true);
assert.equal(acquireCall.script.includes("redis.call('INCR', KEYS[2])"), true);
assert.equal(acquireCall.script.includes("'PX', ARGV[2]"), true);
assert.equal(acquireCall.options.keys.every((key) => key.includes('{schedule_1}')), true);

redis.push('acquire', ['busy', '1786591230000']);
const busy = await lease.acquire('schedule_1');
assert.deepEqual(busy, { status: 'busy', retryAt: '2026-08-13T03:20:30.000Z' });

redis.push('renew', ['renewed', '1786591260000']);
const renewed = await lease.renew({ scheduleId: 'schedule_1', fence: 7 });
assert.deepEqual(renewed, { status: 'renewed', expiresAt: '2026-08-13T03:21:00.000Z' });
const renewCall = redis.calls.at(-1);
assert.deepEqual(renewCall.options.arguments, ['worker-a', '7', '30000']);
assert.equal(renewCall.script.includes("redis.call('PEXPIRE', KEYS[1], ARGV[3])"), true);

redis.push('complete', ['completed']);
assert.deepEqual(await lease.complete({ scheduleId: 'schedule_1', fence: 7 }), { status: 'completed' });
const completeCall = redis.calls.at(-1);
assert.deepEqual(completeCall.options.arguments, ['worker-a', '7', 'schedule-execution:schedule_1']);
assert.equal(completeCall.script.includes("redis.call('SET', KEYS[3], ARGV[3])"), true);
assert.equal(completeCall.script.includes("redis.call('DEL', KEYS[1])"), true);

redis.push('complete', ['already_completed']);
assert.deepEqual(await lease.complete({ scheduleId: 'schedule_1', fence: 7 }), { status: 'already_completed' });

redis.push('renew', ['stale']);
assert.deepEqual(await lease.renew({ scheduleId: 'schedule_1', fence: 6 }), { status: 'stale' });

redis.push('release', ['released']);
assert.deepEqual(await lease.release({ scheduleId: 'schedule_2', fence: 3 }), { status: 'released' });
const releaseCall = redis.calls.at(-1);
assert.equal(releaseCall.script.includes("redis.call('DEL', KEYS[1])"), true);

redis.push('acquire', ['completed']);
assert.deepEqual(await lease.acquire('schedule_1'), {
  status: 'completed',
  idempotencyKey: 'schedule-execution:schedule_1'
});

const failingRedis = {
  async eval() {
    throw new Error('redis://user:super-secret@example.internal');
  }
};
const failingAdapter = createRedisScheduleLeaseAdapter({ redis: failingRedis });
await assert.rejects(
  () => failingAdapter.acquire({ scheduleId: 'schedule_9', holderId: 'worker-a', leaseMs: 30_000 }),
  (error) => error?.message === 'REDIS_SCHEDULE_LEASE_FAILED' && !error.message.includes('super-secret')
);

const malformedRedis = new FakeRedis();
malformedRedis.push('acquire', ['acquired', 'not-a-fence', '1786591200000']);
const malformedAdapter = createRedisScheduleLeaseAdapter({ redis: malformedRedis });
await assert.rejects(
  () => malformedAdapter.acquire({ scheduleId: 'schedule_1', holderId: 'worker-a', leaseMs: 30_000 }),
  /REDIS_SCHEDULE_LEASE_INVALID_RESPONSE:fence/
);

assert.throws(() => createRedisScheduleLeaseAdapter({ redis: {} }), /INVALID_REDIS_SCHEDULE_LEASE:redis/);
assert.throws(() => createRedisScheduleLeaseAdapter({ redis, keyPrefix: 'bad prefix' }), /INVALID_REDIS_SCHEDULE_LEASE:keyPrefix/);

console.log('redis schedule lease adapter tests passed');
