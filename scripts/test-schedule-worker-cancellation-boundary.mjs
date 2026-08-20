import assert from 'node:assert/strict';
import {
  createScheduleWorker,
  WORKER_CANCELLED_ERROR,
  WORKER_STATE_UNCERTAIN_ERROR
} from '../lib/schedule-worker.mjs';

const registry = Object.freeze({
  agents: Object.freeze([Object.freeze({ id: 'minimal-engineer', name: 'Minimal Engineer' })])
});

function schedule(id, overrides = {}) {
  return Object.freeze({
    scheduleId: id,
    traceId: `trace-${id}`,
    agentId: 'minimal-engineer',
    task: `task ${id}`,
    attempts: 1,
    maxAttempts: 2,
    retryDelayMs: 60_000,
    ...overrides
  });
}

{
  const controller = new AbortController();
  const claimed = schedule('schedule_pre_defer');
  const calls = [];
  const store = {
    async claimDue() {
      controller.abort('shutdown-after-claim');
      return [claimed];
    },
    async complete() {
      calls.push('complete');
    },
    async fail() {
      calls.push('fail');
    },
    async defer(scheduleId, input) {
      calls.push(['defer', scheduleId, input]);
    }
  };
  let executions = 0;
  const worker = createScheduleWorker({
    store,
    registry,
    now: () => new Date('2026-08-20T12:00:00.000Z'),
    async executeAgentTask() {
      executions += 1;
      return { ok: true };
    }
  });
  const result = await worker.runDue({ signal: controller.signal });
  assert.equal(executions, 0, 'abort after claim but before execution never invokes the agent task');
  assert.equal(result.cancelled, true);
  assert.equal(result.uncertain, 0, 'pre-execution cancellation has a known no-side-effect outcome');
  assert.deepEqual(result.results[0], {
    scheduleId: claimed.scheduleId,
    ok: false,
    error: WORKER_CANCELLED_ERROR,
    retryScheduled: true,
    retryAt: '2026-08-20T12:01:00.000Z',
    attemptRefunded: true,
    cancelled: true
  });
  assert.equal(calls[0][0], 'defer');
  assert.equal(calls.includes('fail'), false);
  assert.equal(calls.includes('complete'), false);
}

{
  const controller = new AbortController();
  const claimed = schedule('schedule_pre_no_defer');
  const failed = [];
  const store = {
    async claimDue() {
      controller.abort('shutdown-after-claim');
      return [claimed];
    },
    async complete() {
      throw new Error('must not complete');
    },
    async fail(scheduleId, input) {
      failed.push({ scheduleId, input });
    }
  };
  let executions = 0;
  const worker = createScheduleWorker({
    store,
    registry,
    now: () => new Date('2026-08-20T13:00:00.000Z'),
    async executeAgentTask() {
      executions += 1;
      return { ok: true };
    }
  });
  const result = await worker.runDue({ signal: controller.signal });
  assert.equal(executions, 0, 'optional defer support is not required to honor cancellation before execution');
  assert.equal(result.uncertain, 0);
  assert.deepEqual(failed, [{
    scheduleId: claimed.scheduleId,
    input: {
      error: WORKER_CANCELLED_ERROR,
      retryAt: '2026-08-20T13:01:00.000Z'
    }
  }]);
  assert.deepEqual(result.results[0], {
    scheduleId: claimed.scheduleId,
    ok: false,
    error: WORKER_CANCELLED_ERROR,
    retryScheduled: true,
    retryAt: '2026-08-20T13:01:00.000Z',
    attemptRefunded: false,
    cancelled: true
  });
}

{
  const controller = new AbortController();
  const claimed = schedule('schedule_pre_final_attempt', { attempts: 1, maxAttempts: 1 });
  const failed = [];
  const store = {
    async claimDue() {
      controller.abort('shutdown-after-claim');
      return [claimed];
    },
    async complete() {},
    async fail(scheduleId, input) {
      failed.push({ scheduleId, input });
    }
  };
  let executions = 0;
  const worker = createScheduleWorker({
    store,
    registry,
    executeAgentTask: async () => {
      executions += 1;
      return { ok: true };
    }
  });
  const result = await worker.runDue({ signal: controller.signal });
  assert.equal(executions, 0);
  assert.deepEqual(failed, [{ scheduleId: claimed.scheduleId, input: { error: WORKER_CANCELLED_ERROR } }]);
  assert.deepEqual(result.results[0], {
    scheduleId: claimed.scheduleId,
    ok: false,
    error: WORKER_CANCELLED_ERROR,
    retryScheduled: false,
    attemptRefunded: false,
    cancelled: true
  });
}

{
  const controller = new AbortController();
  const claimed = schedule('schedule_mid_execution');
  const failed = [];
  let deferredCalls = 0;
  let completedCalls = 0;
  const store = {
    async claimDue() {
      return [claimed];
    },
    async complete() {
      completedCalls += 1;
    },
    async fail(scheduleId, input) {
      failed.push({ scheduleId, input });
    },
    async defer() {
      deferredCalls += 1;
    }
  };
  const worker = createScheduleWorker({
    store,
    registry,
    async executeAgentTask() {
      controller.abort('shutdown-during-execution');
      return { ok: true, output: 'side effect may already have happened' };
    }
  });
  const result = await worker.runDue({ signal: controller.signal });
  assert.equal(result.cancelled, true);
  assert.equal(result.uncertain, 1, 'post-start abort is surfaced as outcome uncertainty');
  assert.equal(deferredCalls, 0, 'post-start abort is never automatically refunded for replay');
  assert.equal(completedCalls, 0);
  assert.deepEqual(failed, [{ scheduleId: claimed.scheduleId, input: { error: WORKER_CANCELLED_ERROR } }]);
  assert.deepEqual(result.results[0], {
    scheduleId: claimed.scheduleId,
    ok: false,
    error: WORKER_STATE_UNCERTAIN_ERROR,
    outcomeUnknown: true,
    cancelled: true,
    retryScheduled: false
  });
}

{
  const controller = new AbortController();
  const claimed = schedule('schedule_mid_throw');
  let deferCalls = 0;
  const store = {
    async claimDue() {
      return [claimed];
    },
    async complete() {},
    async fail() {},
    async defer() {
      deferCalls += 1;
    }
  };
  const worker = createScheduleWorker({
    store,
    registry,
    async executeAgentTask() {
      controller.abort('shutdown-during-throwing-task');
      throw new Error('secret executor failure after possible side effect');
    }
  });
  const result = await worker.runDue({ signal: controller.signal });
  assert.equal(deferCalls, 0);
  assert.equal(result.uncertain, 1);
  assert.equal(result.results[0].outcomeUnknown, true);
  assert.equal(JSON.stringify(result).includes('secret executor failure'), false);
}

{
  const claimed = schedule('schedule_explicit_cancel');
  let deferred = null;
  const store = {
    async claimDue() {
      return [claimed];
    },
    async complete() {},
    async fail() {},
    async defer(scheduleId, input) {
      deferred = { scheduleId, input };
    }
  };
  const worker = createScheduleWorker({
    store,
    registry,
    now: () => new Date('2026-08-20T14:00:00.000Z'),
    async executeAgentTask() {
      return { ok: false, error: WORKER_CANCELLED_ERROR };
    }
  });
  const result = await worker.runDue();
  assert.equal(result.cancelled, false, 'task-declared cancellation does not imply worker shutdown');
  assert.equal(result.uncertain, 0, 'explicit task cancellation without an aborted worker signal preserves known defer semantics');
  assert.deepEqual(deferred, {
    scheduleId: claimed.scheduleId,
    input: { error: WORKER_CANCELLED_ERROR, runAt: '2026-08-20T14:01:00.000Z' }
  });
  assert.equal(result.results[0].attemptRefunded, true);
  assert.equal(result.results[0].cancelled, true);
}

console.log('schedule worker cancellation boundary tests passed');
