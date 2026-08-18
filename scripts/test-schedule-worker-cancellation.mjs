import assert from 'node:assert/strict';
import { createScheduleWorker, WORKER_CANCELLED_ERROR } from '../lib/schedule-worker.mjs';

const NOW = new Date('2026-08-18T04:30:00.000Z');
const registry = { agents: [{ id: 'minimal-engineer' }] };

function schedule(id, overrides = {}) {
  return {
    scheduleId: id,
    traceId: `trace-${id}`,
    agentId: 'minimal-engineer',
    task: `task-${id}`,
    attempts: 1,
    maxAttempts: 3,
    retryDelayMs: 30_000,
    ...overrides
  };
}

function createStore(claimed = []) {
  const calls = [];
  return {
    calls,
    async claimDue({ limit }) {
      calls.push(['claimDue', limit]);
      return claimed.slice(0, limit);
    },
    async complete(id) {
      calls.push(['complete', id]);
    },
    async fail(id, payload) {
      calls.push(['fail', id, payload]);
    },
    async defer(id, payload) {
      calls.push(['defer', id, payload]);
    }
  };
}

async function testPreAbortedRunDoesNotClaim() {
  const store = createStore([schedule('a')]);
  const controller = new AbortController();
  controller.abort();
  let executed = false;
  const worker = createScheduleWorker({
    store,
    registry,
    now: () => NOW,
    executeAgentTask: async () => {
      executed = true;
      return { ok: true };
    }
  });

  const result = await worker.runDue({ signal: controller.signal });
  assert.equal(result.claimed, 0);
  assert.equal(result.cancelled, true);
  assert.deepEqual(result.results, []);
  assert.equal(executed, false);
  assert.deepEqual(store.calls, []);
}

async function testSignalIsPropagatedToExecutor() {
  const store = createStore([schedule('b')]);
  const controller = new AbortController();
  let receivedSignal = null;
  const worker = createScheduleWorker({
    store,
    registry,
    now: () => NOW,
    executeAgentTask: async ({ signal }) => {
      receivedSignal = signal;
      return { ok: true };
    }
  });

  const result = await worker.runDue({ signal: controller.signal });
  assert.equal(receivedSignal, controller.signal);
  assert.equal(result.cancelled, false);
  assert.deepEqual(store.calls, [['claimDue', 8], ['complete', 'b']]);
}

async function testAbortAfterClaimDefersWithoutExecution() {
  const controller = new AbortController();
  const store = createStore([schedule('c')]);
  store.claimDue = async ({ limit }) => {
    store.calls.push(['claimDue', limit]);
    controller.abort();
    return [schedule('c')];
  };
  let executed = false;
  const worker = createScheduleWorker({
    store,
    registry,
    now: () => NOW,
    executeAgentTask: async () => {
      executed = true;
      return { ok: true };
    }
  });

  const result = await worker.runDue({ signal: controller.signal });
  assert.equal(executed, false);
  assert.equal(result.claimed, 1);
  assert.equal(result.cancelled, true);
  assert.deepEqual(result.results[0], {
    scheduleId: 'c',
    ok: false,
    error: WORKER_CANCELLED_ERROR,
    retryScheduled: true,
    retryAt: '2026-08-18T04:30:30.000Z',
    attemptRefunded: true
  });
  assert.deepEqual(store.calls[1], [
    'defer',
    'c',
    { error: WORKER_CANCELLED_ERROR, runAt: '2026-08-18T04:30:30.000Z' }
  ]);
}

async function testRunningCancellationIsRefunded() {
  const store = createStore([schedule('d')]);
  const controller = new AbortController();
  let resolveStarted;
  const started = new Promise((resolve) => { resolveStarted = resolve; });
  const worker = createScheduleWorker({
    store,
    registry,
    now: () => NOW,
    executeAgentTask: async ({ signal }) => {
      resolveStarted();
      await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
      return { ok: false, error: 'SCHEDULE_AGENT_RUN_CANCELLED' };
    }
  });

  const pending = worker.runDue({ signal: controller.signal });
  await started;
  controller.abort();
  const result = await pending;
  assert.equal(result.cancelled, true);
  assert.equal(result.results[0].error, WORKER_CANCELLED_ERROR);
  assert.equal(result.results[0].attemptRefunded, true);
  assert.equal(store.calls.some(([name]) => name === 'fail'), false);
  assert.equal(store.calls.filter(([name]) => name === 'defer').length, 1);
}

async function testThrownExecutorAfterAbortIsRefunded() {
  const store = createStore([schedule('e')]);
  const controller = new AbortController();
  const worker = createScheduleWorker({
    store,
    registry,
    now: () => NOW,
    executeAgentTask: async () => {
      controller.abort();
      throw new Error('private-provider-error');
    }
  });

  const result = await worker.runDue({ signal: controller.signal });
  assert.equal(result.results[0].error, WORKER_CANCELLED_ERROR);
  assert.equal(result.results[0].attemptRefunded, true);
  assert.equal(JSON.stringify(result).includes('private-provider-error'), false);
}

async function testCancellationUsesPerScheduleRetryDelay() {
  const store = createStore([schedule('f', { retryDelayMs: 5_000 })]);
  const controller = new AbortController();
  const worker = createScheduleWorker({
    store,
    registry,
    now: () => NOW,
    executeAgentTask: async () => {
      controller.abort();
      return { ok: false, error: WORKER_CANCELLED_ERROR };
    }
  });
  const result = await worker.runDue({ signal: controller.signal });
  assert.equal(result.results[0].retryAt, '2026-08-18T04:30:05.000Z');
}

async function testCancellationWithoutDeferFallsBackToFail() {
  const calls = [];
  const controller = new AbortController();
  const store = {
    async claimDue() { return [schedule('g')]; },
    async complete(id) { calls.push(['complete', id]); },
    async fail(id, payload) { calls.push(['fail', id, payload]); }
  };
  const worker = createScheduleWorker({
    store,
    registry,
    now: () => NOW,
    executeAgentTask: async () => {
      controller.abort();
      return { ok: false, error: WORKER_CANCELLED_ERROR };
    }
  });

  const result = await worker.runDue({ signal: controller.signal });
  assert.equal(result.results[0].attemptRefunded, undefined);
  assert.deepEqual(calls[0], ['fail', 'g', { error: WORKER_CANCELLED_ERROR, retryAt: '2026-08-18T04:30:30.000Z' }]);
}

async function testInvalidSignalFailsBeforeClaim() {
  const store = createStore([schedule('h')]);
  const worker = createScheduleWorker({
    store,
    registry,
    executeAgentTask: async () => ({ ok: true })
  });
  await assert.rejects(
    worker.runDue({ signal: { aborted: false } }),
    /INVALID_SCHEDULE_WORKER:signal/
  );
  assert.deepEqual(store.calls, []);
}

async function testLeaseErrorsRemainRefundable() {
  const store = createStore([schedule('i')]);
  const worker = createScheduleWorker({
    store,
    registry,
    now: () => NOW,
    executeAgentTask: async () => ({
      ok: false,
      error: 'SCHEDULE_LEASE_BUSY',
      retryAt: '2026-08-18T04:31:00.000Z'
    })
  });
  const result = await worker.runDue();
  assert.equal(result.results[0].attemptRefunded, true);
  assert.equal(result.results[0].retryAt, '2026-08-18T04:31:00.000Z');
}

async function testNormalFailureStillConsumesAttempt() {
  const store = createStore([schedule('j', { attempts: 1, maxAttempts: 2 })]);
  const worker = createScheduleWorker({
    store,
    registry,
    now: () => NOW,
    executeAgentTask: async () => ({ ok: false, error: 'MODEL_FAILED' })
  });
  const result = await worker.runDue();
  assert.equal(result.results[0].attemptRefunded, undefined);
  assert.deepEqual(store.calls[1], ['fail', 'j', { error: 'MODEL_FAILED', retryAt: '2026-08-18T04:30:30.000Z' }]);
}

await testPreAbortedRunDoesNotClaim();
await testSignalIsPropagatedToExecutor();
await testAbortAfterClaimDefersWithoutExecution();
await testRunningCancellationIsRefunded();
await testThrownExecutorAfterAbortIsRefunded();
await testCancellationUsesPerScheduleRetryDelay();
await testCancellationWithoutDeferFallsBackToFail();
await testInvalidSignalFailsBeforeClaim();
await testLeaseErrorsRemainRefundable();
await testNormalFailureStillConsumesAttempt();

process.stdout.write('schedule worker cancellation tests passed\n');
