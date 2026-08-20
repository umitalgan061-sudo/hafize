import assert from 'node:assert/strict';
import {
  createScheduleWorker,
  SCHEDULE_EXECUTION_RESULT_INVALID,
  WORKER_STATE_UNCERTAIN_ERROR
} from '../lib/schedule-worker.mjs';

const registry = { agents: [{ id: 'minimal-engineer', name: 'Minimal Engineer' }] };
const now = () => new Date('2026-08-20T17:00:00.000Z');

function schedule(id, attempts = 1, maxAttempts = 2) {
  return {
    scheduleId: id,
    traceId: `trace-${id}`,
    agentId: 'minimal-engineer',
    task: `Task ${id}`,
    attempts,
    maxAttempts,
    retryDelayMs: 60_000
  };
}

function storeFor(item) {
  const calls = [];
  let claimed = false;
  return {
    calls,
    async claimDue() {
      if (claimed) return [];
      claimed = true;
      calls.push(['claimDue']);
      return [structuredClone(item)];
    },
    async complete(id) { calls.push(['complete', id]); },
    async fail(id, detail) { calls.push(['fail', id, structuredClone(detail)]); },
    async defer(id, detail) { calls.push(['defer', id, structuredClone(detail)]); }
  };
}

{
  const item = schedule('post-exec-abort-invalid');
  const store = storeFor(item);
  const controller = new AbortController();
  let executed = 0;
  const worker = createScheduleWorker({
    store,
    registry,
    now,
    async executeAgentTask() {
      executed += 1;
      controller.abort('user stopped after side effect boundary');
      return { ok: true, forged: true };
    }
  });

  const output = await worker.runDue({ signal: controller.signal });
  assert.equal(executed, 1);
  assert.equal(output.claimed, 1);
  assert.equal(output.cancelled, true);
  assert.equal(output.uncertain, 1);
  assert.equal(output.invalidResults, 0, 'post-execution abort takes precedence over invalid result accounting');
  assert.deepEqual(output.results[0], {
    scheduleId: item.scheduleId,
    ok: false,
    error: WORKER_STATE_UNCERTAIN_ERROR,
    outcomeUnknown: true,
    cancelled: true,
    retryScheduled: false
  });
  assert.deepEqual(store.calls.at(-1), [
    'fail', item.scheduleId, { error: 'SCHEDULE_EXECUTION_CANCELLED' }
  ]);
  assert.equal(store.calls.some(([type]) => type === 'complete'), false);
  assert.equal(store.calls.some(([type]) => type === 'defer'), false);
}

{
  const item = schedule('normal-invalid');
  const store = storeFor(item);
  const controller = new AbortController();
  const worker = createScheduleWorker({
    store,
    registry,
    now,
    async executeAgentTask() {
      return { ok: true, forged: true };
    }
  });
  const output = await worker.runDue({ signal: controller.signal });
  assert.equal(output.cancelled, false);
  assert.equal(output.uncertain, 0);
  assert.equal(output.invalidResults, 1);
  assert.deepEqual(output.results[0], {
    scheduleId: item.scheduleId,
    ok: false,
    error: SCHEDULE_EXECUTION_RESULT_INVALID,
    retryScheduled: true,
    contractInvalid: true
  });
}

{
  const item = schedule('throw-then-abort');
  const store = storeFor(item);
  const controller = new AbortController();
  const worker = createScheduleWorker({
    store,
    registry,
    now,
    async executeAgentTask() {
      controller.abort('stop');
      throw new Error('private executor detail');
    }
  });
  const output = await worker.runDue({ signal: controller.signal });
  assert.equal(output.uncertain, 1);
  assert.equal(output.invalidResults, 0);
  assert.equal(output.results[0].error, WORKER_STATE_UNCERTAIN_ERROR);
  assert.equal(JSON.stringify(output).includes('private executor detail'), false);
}

{
  const item = schedule('cancel-before-execute');
  const store = storeFor(item);
  const controller = new AbortController();
  controller.abort('already stopped');
  let executed = 0;
  const worker = createScheduleWorker({
    store,
    registry,
    now,
    async executeAgentTask() {
      executed += 1;
      return { ok: true };
    }
  });
  const output = await worker.runDue({ signal: controller.signal });
  assert.equal(executed, 0);
  assert.equal(output.claimed, 0);
  assert.equal(output.cancelled, true);
  assert.equal(output.uncertain, 0);
  assert.deepEqual(output.results, []);
  assert.deepEqual(store.calls, [], 'pre-claim cancellation does not touch store');
}

console.log('schedule worker result cancellation precedence tests passed');
