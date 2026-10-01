import assert from 'node:assert/strict';
import { createScheduleExecutionLeaseBoundary, type ScheduleLeaseAdapter } from '../lib/schedule-execution-lease.ts';

type State = { holderId: string; fence: number; completed: boolean };
const state = new Map<string, State>();
let nextFence = 1;
const calls: Array<[string, Record<string, unknown>]> = [];

const adapter: ScheduleLeaseAdapter = {
  async acquire(input) {
    calls.push(['acquire', input]);
    const current = state.get(String(input.scheduleId));
    if (current?.completed) return { status: 'completed' };
    if (current?.holderId && current.holderId !== input.holderId) return { status: 'busy', retryAt: '2026-10-01T12:00:10.000Z' };
    const fence = nextFence++;
    state.set(String(input.scheduleId), { holderId: String(input.holderId), fence, completed: false });
    return { status: 'acquired', fence, expiresAt: '2026-10-01T12:00:30.000Z' };
  },
  async renew(input) {
    calls.push(['renew', input]);
    const current = state.get(String(input.scheduleId));
    if (current?.completed) return { status: 'completed' };
    if (!current || current.holderId !== input.holderId || current.fence !== input.fence) return { status: 'stale' };
    return { status: 'renewed', expiresAt: '2026-10-01T12:01:00.000Z' };
  },
  async complete(input) {
    calls.push(['complete', input]);
    const current = state.get(String(input.scheduleId));
    if (current?.completed) return { status: 'already_completed' };
    if (!current || current.holderId !== input.holderId || current.fence !== input.fence) return { status: 'stale' };
    state.set(String(input.scheduleId), { ...current, completed: true });
    return { status: 'completed' };
  },
  async release(input) {
    calls.push(['release', input]);
    const current = state.get(String(input.scheduleId));
    if (current?.completed) return { status: 'completed' };
    if (!current || current.holderId !== input.holderId || current.fence !== input.fence) return { status: 'stale' };
    state.delete(String(input.scheduleId));
    return { status: 'released' };
  }
};

const workerA = createScheduleExecutionLeaseBoundary({ adapter, holderId: 'worker-a', leaseMs: 20_000 });
const workerB = createScheduleExecutionLeaseBoundary({ adapter, holderId: 'worker-b', leaseMs: 20_000 });
assert.equal(workerA.leaseMs, 20_000);
assert.equal(workerA.providerTimeoutMs, 5_000);

const first = await workerA.acquire('schedule_42');
assert.deepEqual(first, {
  status: 'acquired', fence: 1, expiresAt: '2026-10-01T12:00:30.000Z',
  idempotencyKey: 'schedule-execution:schedule_42'
});
assert.deepEqual(await workerB.acquire('schedule_42'), { status: 'busy', retryAt: '2026-10-01T12:00:10.000Z' });
assert.deepEqual(await workerA.renew({ scheduleId: 'schedule_42', fence: Number(first.fence) }), { status: 'renewed', expiresAt: '2026-10-01T12:01:00.000Z' });
assert.deepEqual(await workerB.renew({ scheduleId: 'schedule_42', fence: Number(first.fence) }), { status: 'stale' });
assert.deepEqual(await workerB.complete({ scheduleId: 'schedule_42', fence: Number(first.fence) }), { status: 'stale' });
assert.deepEqual(await workerA.complete({ scheduleId: 'schedule_42', fence: Number(first.fence) }), { status: 'completed' });
assert.deepEqual(await workerA.complete({ scheduleId: 'schedule_42', fence: Number(first.fence) }), { status: 'already_completed' });
assert.deepEqual(await workerB.acquire('schedule_42'), { status: 'completed', idempotencyKey: 'schedule-execution:schedule_42' });

const completeCall = calls.find(([name]) => name === 'complete')?.[1] || {};
assert.equal(completeCall.idempotencyKey, 'schedule-execution:schedule_42');
assert.equal('token' in completeCall, false);

const released = await workerA.acquire('schedule_43');
assert.deepEqual(await workerA.release({ scheduleId: 'schedule_43', fence: Number(released.fence) }), { status: 'released' });
assert.deepEqual(await workerA.release({ scheduleId: 'schedule_43', fence: Number(released.fence) }), { status: 'stale' });

assert.throws(() => createScheduleExecutionLeaseBoundary({ adapter, holderId: 'bad holder' }), /INVALID_SCHEDULE_LEASE:holderId/);
await assert.rejects(() => workerA.acquire('../secret'), /INVALID_SCHEDULE_LEASE:scheduleId/);
await assert.rejects(() => workerA.complete({ scheduleId: 'schedule_42', fence: 0 }), /INVALID_SCHEDULE_LEASE:fence/);

const brokenAdapter: ScheduleLeaseAdapter = {
  acquire: async () => ({ status: 'acquired', fence: 1, expiresAt: 'not-a-date' }),
  renew: async () => ({ status: 'renewed', expiresAt: 'not-a-date' }),
  complete: async () => ({ status: 'unknown' }),
  release: async () => { throw new Error('database password leaked'); }
};
const broken = createScheduleExecutionLeaseBoundary({ adapter: brokenAdapter, holderId: 'worker-c' });
await assert.rejects(() => broken.acquire('schedule_1'), /SCHEDULE_LEASE_PROVIDER_INVALID_RESPONSE:expiresAt/);
await assert.rejects(() => broken.renew({ scheduleId: 'schedule_1', fence: 1 }), /SCHEDULE_LEASE_PROVIDER_INVALID_RESPONSE:expiresAt/);
await assert.rejects(() => broken.complete({ scheduleId: 'schedule_1', fence: 1 }), /SCHEDULE_LEASE_PROVIDER_INVALID_RESPONSE:response/);
await assert.rejects(() => broken.release({ scheduleId: 'schedule_1', fence: 1 }), (error: unknown) => error instanceof Error && error.message === 'SCHEDULE_LEASE_PROVIDER_FAILED');

const bounded = createScheduleExecutionLeaseBoundary({ adapter, holderId: 'worker-d', leaseMs: 1 });
assert.equal(bounded.leaseMs, 1_000);
assert.equal(bounded.providerTimeoutMs, 250);

const timeoutAdapter: ScheduleLeaseAdapter = {
  acquire: async () => new Promise(() => {}),
  renew: async () => ({ status: 'renewed', expiresAt: '2026-10-01T12:01:00.000Z' }),
  complete: async () => ({ status: 'completed' }),
  release: async () => ({ status: 'released' })
};
const timed = createScheduleExecutionLeaseBoundary({ adapter: timeoutAdapter, holderId: 'worker-timeout', leaseMs: 1_000, providerTimeoutMs: 100 });
const started = Date.now();
await assert.rejects(() => timed.acquire('schedule_timeout'), /SCHEDULE_LEASE_PROVIDER_FAILED/);
assert.ok(Date.now() - started < 1_000);

const upper = createScheduleExecutionLeaseBoundary({ adapter, holderId: 'worker-upper', leaseMs: 1_000, providerTimeoutMs: 60_000 });
assert.equal(upper.providerTimeoutMs, 900);
assert.ok(upper.providerTimeoutMs < upper.leaseMs);

console.log('schedule execution lease TypeScript tests passed');
