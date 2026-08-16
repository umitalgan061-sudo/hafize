import assert from 'node:assert/strict';
import { createScheduleLeaseGuardedExecutor } from '../lib/schedule-lease-executor.mjs';

function createLease(overrides = {}) {
  return {
    leaseMs: 1_000,
    acquire: async () => ({ status: 'acquired', fence: 1, expiresAt: '2026-08-12T20:00:01.000Z' }),
    renew: async () => ({ status: 'renewed', expiresAt: '2026-08-12T20:00:01.000Z' }),
    complete: async () => ({ status: 'completed' }),
    release: async () => ({ status: 'released' }),
    ...overrides
  };
}

let executed = 0;
let completed = 0;
const success = createScheduleLeaseGuardedExecutor({
  lease: createLease({
    async complete(input) {
      completed += 1;
      assert.deepEqual(input, { scheduleId: 'schedule_1', fence: 1 });
      return { status: 'completed' };
    }
  }),
  async executeAgentTask(input) {
    executed += 1;
    assert.equal(input.traceId, 'trace-1');
    return { ok: true, content: 'done' };
  },
  renewIntervalMs: 100
});
const successResult = await success.executeAgentTask({ scheduleId: 'schedule_1', traceId: 'trace-1' });
assert.equal(successResult.ok, true);
assert.equal(successResult.content, 'done');
assert.equal(successResult.leaseStatus, 'completed');
assert.equal(executed, 1);
assert.equal(completed, 1);

executed = 0;
const busy = createScheduleLeaseGuardedExecutor({
  lease: createLease({
    acquire: async () => ({ status: 'busy', retryAt: '2026-08-12T20:01:00.000Z' })
  }),
  executeAgentTask: async () => {
    executed += 1;
    return { ok: true };
  }
});
const busyResult = await busy.executeAgentTask({ scheduleId: 'schedule_2' });
assert.deepEqual(busyResult, {
  ok: false,
  error: 'SCHEDULE_LEASE_BUSY',
  retryAt: '2026-08-12T20:01:00.000Z'
});
assert.equal(executed, 0);

const alreadyCompleted = createScheduleLeaseGuardedExecutor({
  lease: createLease({ acquire: async () => ({ status: 'completed' }) }),
  executeAgentTask: async () => {
    executed += 1;
    return { ok: true };
  }
});
const deduplicated = await alreadyCompleted.executeAgentTask({ scheduleId: 'schedule_3' });
assert.deepEqual(deduplicated, { ok: true, deduplicated: true, leaseStatus: 'completed' });
assert.equal(executed, 0);

let releases = 0;
const failedTask = createScheduleLeaseGuardedExecutor({
  lease: createLease({
    async release(input) {
      releases += 1;
      assert.deepEqual(input, { scheduleId: 'schedule_4', fence: 1 });
      return { status: 'released' };
    }
  }),
  executeAgentTask: async () => ({ ok: false, error: 'TEMPORARY_FAILURE' })
});
const failedResult = await failedTask.executeAgentTask({ scheduleId: 'schedule_4' });
assert.deepEqual(failedResult, { ok: false, error: 'TEMPORARY_FAILURE' });
assert.equal(releases, 1);

const thrownTask = createScheduleLeaseGuardedExecutor({
  lease: createLease(),
  executeAgentTask: async () => {
    throw new Error('secret task detail');
  }
});
const thrownResult = await thrownTask.executeAgentTask({ scheduleId: 'schedule_5' });
assert.deepEqual(thrownResult, { ok: false, error: 'SCHEDULE_EXECUTION_FAILED' });
assert.equal(JSON.stringify(thrownResult).includes('secret task detail'), false);

let renewals = 0;
const heartbeat = createScheduleLeaseGuardedExecutor({
  lease: createLease({
    async renew() {
      renewals += 1;
      return { status: 'renewed', expiresAt: '2026-08-12T20:00:02.000Z' };
    }
  }),
  executeAgentTask: async () => {
    await new Promise((resolve) => setTimeout(resolve, 260));
    return { ok: true };
  },
  renewIntervalMs: 100
});
const heartbeatResult = await heartbeat.executeAgentTask({ scheduleId: 'schedule_6' });
assert.equal(heartbeatResult.ok, true);
assert.ok(renewals >= 2);

let staleCompleteCalls = 0;
const lostLease = createScheduleLeaseGuardedExecutor({
  lease: createLease({
    renew: async () => ({ status: 'stale' }),
    async complete() {
      staleCompleteCalls += 1;
      return { status: 'completed' };
    }
  }),
  executeAgentTask: async () => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return { ok: true, content: 'must-not-commit' };
  },
  renewIntervalMs: 100
});
const lostResult = await lostLease.executeAgentTask({ scheduleId: 'schedule_7' });
assert.deepEqual(lostResult, { ok: false, error: 'SCHEDULE_LEASE_LOST' });
assert.equal(staleCompleteCalls, 0);

const staleCompletion = createScheduleLeaseGuardedExecutor({
  lease: createLease({ complete: async () => ({ status: 'stale' }) }),
  executeAgentTask: async () => ({ ok: true })
});
assert.deepEqual(
  await staleCompletion.executeAgentTask({ scheduleId: 'schedule_8' }),
  { ok: false, error: 'SCHEDULE_LEASE_LOST' }
);

const completedDuringRelease = createScheduleLeaseGuardedExecutor({
  lease: createLease({ release: async () => ({ status: 'completed' }) }),
  executeAgentTask: async () => ({ ok: false, error: 'TEMPORARY_FAILURE' })
});
assert.deepEqual(
  await completedDuringRelease.executeAgentTask({ scheduleId: 'schedule_9' }),
  { ok: true, deduplicated: true, leaseStatus: 'completed' }
);

assert.deepEqual(
  await success.executeAgentTask({ scheduleId: ' ' }),
  { ok: false, error: 'INVALID_SCHEDULE_AGENT_TASK' }
);
assert.throws(
  () => createScheduleLeaseGuardedExecutor({ lease: {}, executeAgentTask: async () => ({ ok: true }) }),
  /INVALID_SCHEDULE_LEASE_EXECUTOR:lease/
);
assert.throws(
  () => createScheduleLeaseGuardedExecutor({ lease: createLease() }),
  /INVALID_SCHEDULE_LEASE_EXECUTOR:executeAgentTask/
);

await import('./test-schedule-cancellation.mjs');
console.log('schedule lease executor tests passed');
