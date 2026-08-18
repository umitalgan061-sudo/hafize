import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import {
  createScheduleLeaseGuardedExecutor,
  EXECUTION_CANCELLED_ERROR,
  LEASE_LOST_ERROR
} from '../lib/schedule-lease-executor.mjs';

function createLease(overrides = {}) {
  const calls = [];
  let fence = 1;
  const lease = {
    leaseMs: 1_000,
    async acquire(scheduleId) {
      calls.push(['acquire', scheduleId]);
      return { status: 'acquired', fence: fence++ };
    },
    async renew(input) {
      calls.push(['renew', input.scheduleId, input.fence]);
      return { status: 'renewed' };
    },
    async complete(input) {
      calls.push(['complete', input.scheduleId, input.fence]);
      return { status: 'completed' };
    },
    async release(input) {
      calls.push(['release', input.scheduleId, input.fence]);
      return { status: 'released' };
    },
    ...overrides
  };
  return { lease, calls };
}

async function testPreAbortedSkipsLeaseAcquisition() {
  const { lease, calls } = createLease();
  let executed = false;
  const controller = new AbortController();
  controller.abort('caller-stop');
  const guarded = createScheduleLeaseGuardedExecutor({
    lease,
    executeAgentTask: async () => {
      executed = true;
      return { ok: true };
    }
  });

  const result = await guarded.executeAgentTask({ scheduleId: 's-pre', signal: controller.signal });
  assert.deepEqual(result, { ok: false, error: EXECUTION_CANCELLED_ERROR });
  assert.equal(executed, false);
  assert.deepEqual(calls, []);
}

async function testAbortAfterAcquireReleasesWithoutExecuting() {
  const controller = new AbortController();
  const calls = [];
  const lease = {
    leaseMs: 1_000,
    async acquire(scheduleId) {
      calls.push(['acquire', scheduleId]);
      controller.abort('after-acquire');
      return { status: 'acquired', fence: 9 };
    },
    async renew() {
      throw new Error('renew should not run');
    },
    async complete() {
      throw new Error('complete should not run');
    },
    async release(input) {
      calls.push(['release', input.scheduleId, input.fence]);
      return { status: 'released' };
    }
  };
  let executed = false;
  const guarded = createScheduleLeaseGuardedExecutor({
    lease,
    executeAgentTask: async () => {
      executed = true;
      return { ok: true };
    }
  });

  const result = await guarded.executeAgentTask({ scheduleId: 's-after-acquire', signal: controller.signal });
  assert.deepEqual(result, { ok: false, error: EXECUTION_CANCELLED_ERROR });
  assert.equal(executed, false);
  assert.deepEqual(calls, [['acquire', 's-after-acquire'], ['release', 's-after-acquire', 9]]);
}

async function testAbortDuringExecutionPropagatesAndReleases() {
  const { lease, calls } = createLease();
  const caller = new AbortController();
  let observedSignal = null;
  let resolveStarted;
  const started = new Promise((resolve) => { resolveStarted = resolve; });

  const guarded = createScheduleLeaseGuardedExecutor({
    lease,
    renewIntervalMs: 100,
    executeAgentTask: async ({ signal }) => {
      observedSignal = signal;
      resolveStarted();
      return new Promise((resolve) => {
        signal.addEventListener('abort', () => resolve({ ok: false, error: 'INNER_CANCELLED' }), { once: true });
      });
    }
  });

  const pending = guarded.executeAgentTask({ scheduleId: 's-running', signal: caller.signal });
  await started;
  assert.ok(observedSignal);
  assert.equal(observedSignal.aborted, false);
  caller.abort('user-stop');
  const result = await pending;

  assert.equal(observedSignal.aborted, true);
  assert.deepEqual(result, { ok: false, error: EXECUTION_CANCELLED_ERROR });
  assert.deepEqual(calls.filter(([name]) => name === 'complete'), []);
  assert.equal(calls.filter(([name]) => name === 'release').length, 1);
}

async function testCancellationStopsFutureRenewals() {
  let renewCount = 0;
  const caller = new AbortController();
  const { lease } = createLease({
    async renew() {
      renewCount += 1;
      return { status: 'renewed' };
    }
  });
  let resolveStarted;
  const started = new Promise((resolve) => { resolveStarted = resolve; });
  const guarded = createScheduleLeaseGuardedExecutor({
    lease,
    renewIntervalMs: 100,
    executeAgentTask: async ({ signal }) => {
      resolveStarted();
      await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
      return { ok: false, error: 'CANCELLED' };
    }
  });

  const pending = guarded.executeAgentTask({ scheduleId: 's-renew', signal: caller.signal });
  await started;
  await delay(130);
  caller.abort();
  await pending;
  const countAtFinish = renewCount;
  await delay(180);
  assert.equal(renewCount, countAtFinish);
}

async function testLeaseLossWinsRaceWithCallerCancellation() {
  const caller = new AbortController();
  let renewResolve;
  let resolveStarted;
  const started = new Promise((resolve) => { resolveStarted = resolve; });
  const { lease } = createLease({
    async renew() {
      return new Promise((resolve) => { renewResolve = resolve; });
    }
  });
  const guarded = createScheduleLeaseGuardedExecutor({
    lease,
    renewIntervalMs: 100,
    executeAgentTask: async ({ signal }) => {
      resolveStarted();
      await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
      return { ok: false, error: 'STOPPED' };
    }
  });

  const pending = guarded.executeAgentTask({ scheduleId: 's-race', signal: caller.signal });
  await started;
  await delay(120);
  assert.equal(typeof renewResolve, 'function');
  renewResolve({ status: 'stale' });
  await delay(0);
  caller.abort();
  const result = await pending;
  assert.deepEqual(result, { ok: false, error: LEASE_LOST_ERROR });
}

async function testCancellationReleaseStaleReportsLeaseLoss() {
  const caller = new AbortController();
  let resolveStarted;
  const started = new Promise((resolve) => { resolveStarted = resolve; });
  const { lease } = createLease({
    async release() {
      return { status: 'stale' };
    }
  });
  const guarded = createScheduleLeaseGuardedExecutor({
    lease,
    executeAgentTask: async ({ signal }) => {
      resolveStarted();
      await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
      return { ok: false, error: 'STOPPED' };
    }
  });
  const pending = guarded.executeAgentTask({ scheduleId: 's-stale', signal: caller.signal });
  await started;
  caller.abort();
  assert.deepEqual(await pending, { ok: false, error: LEASE_LOST_ERROR });
}

async function testCompletedLeaseWinsCancellationAfterAcquire() {
  const caller = new AbortController();
  const lease = {
    leaseMs: 1_000,
    async acquire() {
      caller.abort();
      return { status: 'completed' };
    },
    async renew() { throw new Error('unused'); },
    async complete() { throw new Error('unused'); },
    async release() { throw new Error('unused'); }
  };
  const guarded = createScheduleLeaseGuardedExecutor({ lease, executeAgentTask: async () => ({ ok: true }) });
  assert.deepEqual(await guarded.executeAgentTask({ scheduleId: 's-done', signal: caller.signal }), {
    ok: true,
    deduplicated: true,
    leaseStatus: 'completed'
  });
}

async function testInvalidSignalFailsClosedBeforeAcquire() {
  const { lease, calls } = createLease();
  const guarded = createScheduleLeaseGuardedExecutor({ lease, executeAgentTask: async () => ({ ok: true }) });
  const result = await guarded.executeAgentTask({ scheduleId: 's-invalid', signal: { aborted: false } });
  assert.deepEqual(result, { ok: false, error: 'INVALID_SCHEDULE_AGENT_TASK' });
  assert.deepEqual(calls, []);
}

await testPreAbortedSkipsLeaseAcquisition();
await testAbortAfterAcquireReleasesWithoutExecuting();
await testAbortDuringExecutionPropagatesAndReleases();
await testCancellationStopsFutureRenewals();
await testLeaseLossWinsRaceWithCallerCancellation();
await testCancellationReleaseStaleReportsLeaseLoss();
await testCompletedLeaseWinsCancellationAfterAcquire();
await testInvalidSignalFailsClosedBeforeAcquire();

process.stdout.write('schedule lease caller cancellation tests passed\n');
