import assert from 'node:assert/strict';
import { createScheduleExecutionLeaseBoundary } from '../lib/schedule-execution-lease.mjs';

const state = new Map();
let nextFence = 1;
const calls = [];
const adapter = {
  async acquire(input) {
    calls.push(['acquire', input]);
    const current = state.get(input.scheduleId);
    if (current?.completed) return { status: 'completed' };
    if (current?.holderId && current.holderId !== input.holderId) {
      return { status: 'busy', retryAt: '2026-08-12T19:00:10.000Z' };
    }
    const fence = nextFence++;
    state.set(input.scheduleId, { holderId: input.holderId, fence, completed: false });
    return { status: 'acquired', fence, expiresAt: '2026-08-12T19:00:30.000Z' };
  },
  async renew(input) {
    calls.push(['renew', input]);
    const current = state.get(input.scheduleId);
    if (current?.completed) return { status: 'completed' };
    if (!current || current.holderId !== input.holderId || current.fence !== input.fence) return { status: 'stale' };
    return { status: 'renewed', expiresAt: '2026-08-12T19:01:00.000Z' };
  },
  async complete(input) {
    calls.push(['complete', input]);
    const current = state.get(input.scheduleId);
    if (current?.completed) return { status: 'already_completed' };
    if (!current || current.holderId !== input.holderId || current.fence !== input.fence) return { status: 'stale' };
    state.set(input.scheduleId, { ...current, completed: true });
    return { status: 'completed' };
  },
  async release(input) {
    calls.push(['release', input]);
    const current = state.get(input.scheduleId);
    if (current?.completed) return { status: 'completed' };
    if (!current || current.holderId !== input.holderId || current.fence !== input.fence) return { status: 'stale' };
    state.delete(input.scheduleId);
    return { status: 'released' };
  }
};

const workerA = createScheduleExecutionLeaseBoundary({ adapter, holderId: 'worker-a', leaseMs: 20_000 });
const workerB = createScheduleExecutionLeaseBoundary({ adapter, holderId: 'worker-b', leaseMs: 20_000 });
assert.equal(Object.isFrozen(workerA), true);
assert.equal(workerA.leaseMs, 20_000);

const first = await workerA.acquire('schedule_42');
assert.deepEqual(first, {
  status: 'acquired',
  fence: 1,
  expiresAt: '2026-08-12T19:00:30.000Z',
  idempotencyKey: 'schedule-execution:schedule_42'
});
assert.equal(Object.isFrozen(first), true);

const busy = await workerB.acquire('schedule_42');
assert.deepEqual(busy, { status: 'busy', retryAt: '2026-08-12T19:00:10.000Z' });

assert.deepEqual(await workerA.renew({ scheduleId: 'schedule_42', fence: first.fence }), {
  status: 'renewed', expiresAt: '2026-08-12T19:01:00.000Z'
});
assert.deepEqual(await workerB.renew({ scheduleId: 'schedule_42', fence: first.fence }), { status: 'stale' });

assert.deepEqual(await workerB.complete({ scheduleId: 'schedule_42', fence: first.fence }), { status: 'stale' });
assert.equal(state.get('schedule_42').completed, false);
assert.deepEqual(await workerA.complete({ scheduleId: 'schedule_42', fence: first.fence }), { status: 'completed' });
assert.equal(state.get('schedule_42').completed, true);
assert.deepEqual(await workerA.complete({ scheduleId: 'schedule_42', fence: first.fence }), { status: 'already_completed' });
assert.deepEqual(await workerB.acquire('schedule_42'), {
  status: 'completed', idempotencyKey: 'schedule-execution:schedule_42'
});

const idempotencyCall = calls.find(([name]) => name === 'complete')[1];
assert.equal(idempotencyCall.idempotencyKey, 'schedule-execution:schedule_42');
assert.equal('token' in idempotencyCall, false);

const released = await workerA.acquire('schedule_43');
assert.deepEqual(await workerA.release({ scheduleId: 'schedule_43', fence: released.fence }), { status: 'released' });
assert.deepEqual(await workerA.release({ scheduleId: 'schedule_43', fence: released.fence }), { status: 'stale' });

assert.throws(() => createScheduleExecutionLeaseBoundary({ adapter, holderId: 'bad holder' }), /INVALID_SCHEDULE_LEASE:holderId/);
await assert.rejects(() => workerA.acquire('../secret'), /INVALID_SCHEDULE_LEASE:scheduleId/);
await assert.rejects(() => workerA.complete({ scheduleId: 'schedule_42', fence: 0 }), /INVALID_SCHEDULE_LEASE:fence/);

const broken = createScheduleExecutionLeaseBoundary({
  holderId: 'worker-c',
  adapter: {
    acquire: async () => ({ status: 'acquired', fence: 1, expiresAt: 'not-a-date' }),
    renew: async () => ({ status: 'renewed', expiresAt: 'not-a-date' }),
    complete: async () => ({ status: 'unknown' }),
    release: async () => { throw new Error('database password leaked'); }
  }
});
await assert.rejects(() => broken.acquire('schedule_1'), /SCHEDULE_LEASE_PROVIDER_INVALID_RESPONSE:expiresAt/);
await assert.rejects(() => broken.renew({ scheduleId: 'schedule_1', fence: 1 }), /SCHEDULE_LEASE_PROVIDER_INVALID_RESPONSE:expiresAt/);
await assert.rejects(() => broken.complete({ scheduleId: 'schedule_1', fence: 1 }), /SCHEDULE_LEASE_PROVIDER_INVALID_RESPONSE:response/);
await assert.rejects(() => broken.release({ scheduleId: 'schedule_1', fence: 1 }), (error) => {
  assert.equal(error.message, 'SCHEDULE_LEASE_PROVIDER_FAILED');
  assert.equal(error.message.includes('password'), false);
  return true;
});

const bounded = createScheduleExecutionLeaseBoundary({ adapter, holderId: 'worker-d', leaseMs: 1 });
assert.equal(bounded.leaseMs, 1_000);

console.log('schedule execution lease tests passed');
