import assert from 'node:assert/strict';
import {
  createScheduleWorker,
  SCHEDULE_EXECUTION_RESULT_INVALID
} from '../lib/schedule-worker.mjs';

const registry = { agents: [{ id: 'minimal-engineer', name: 'Minimal Engineer' }] };
const now = () => new Date('2026-08-20T17:00:00.000Z');

function claimed(overrides = {}) {
  return {
    scheduleId: 'sched-1',
    traceId: 'trace-1',
    agentId: 'minimal-engineer',
    task: 'Güvenli sonucu işle.',
    attempts: 1,
    maxAttempts: 2,
    retryDelayMs: 60_000,
    ...overrides
  };
}

function createStore(schedule = claimed()) {
  const calls = [];
  let claimedOnce = false;
  return {
    calls,
    async claimDue() {
      if (claimedOnce) return [];
      claimedOnce = true;
      calls.push(['claimDue']);
      return [structuredClone(schedule)];
    },
    async complete(scheduleId) {
      calls.push(['complete', scheduleId]);
    },
    async fail(scheduleId, detail) {
      calls.push(['fail', scheduleId, structuredClone(detail)]);
    },
    async defer(scheduleId, detail) {
      calls.push(['defer', scheduleId, structuredClone(detail)]);
    }
  };
}

async function runWithResult(result, schedule = claimed()) {
  const store = createStore(schedule);
  const worker = createScheduleWorker({
    store,
    registry,
    now,
    retryDelayMs: 60_000,
    executeAgentTask: async () => result
  });
  const output = await worker.runDue();
  return { store, output };
}

{
  const { store, output } = await runWithResult({ ok: true });
  assert.equal(output.claimed, 1);
  assert.equal(output.uncertain, 0);
  assert.equal(output.invalidResults, 0);
  assert.deepEqual(output.results[0], { scheduleId: 'sched-1', ok: true });
  assert.deepEqual(store.calls.at(-1), ['complete', 'sched-1']);
}

{
  const { store, output } = await runWithResult({ ok: false, error: 'TEMPORARY_FAILURE' });
  assert.equal(output.invalidResults, 0);
  assert.equal(output.results[0].error, 'TEMPORARY_FAILURE');
  assert.equal(output.results[0].retryScheduled, true);
  assert.deepEqual(store.calls.at(-1), [
    'fail',
    'sched-1',
    { error: 'TEMPORARY_FAILURE', retryAt: '2026-08-20T17:01:00.000Z' }
  ]);
}

{
  const { store, output } = await runWithResult({
    ok: false,
    error: 'SCHEDULE_LEASE_BUSY',
    retryAt: '2026-08-20T17:05:00.000Z'
  });
  assert.equal(output.invalidResults, 0);
  assert.equal(output.results[0].attemptRefunded, true);
  assert.equal(output.results[0].retryAt, '2026-08-20T17:05:00.000Z');
  assert.deepEqual(store.calls.at(-1), [
    'defer',
    'sched-1',
    { error: 'SCHEDULE_LEASE_BUSY', runAt: '2026-08-20T17:05:00.000Z' }
  ]);
}

for (const [label, result] of [
  ['null', null],
  ['undefined', undefined],
  ['array', []],
  ['string', 'success'],
  ['truthy ok', { ok: 1 }],
  ['success extra', { ok: true, error: 'FAKE' }],
  ['failure missing error', { ok: false }],
  ['invalid error syntax', { ok: false, error: 'not safe' }],
  ['reserved worker error', { ok: false, error: 'SCHEDULE_EXECUTION_STATE_UNCERTAIN' }],
  ['extra failure field', { ok: false, error: 'SCHEDULE_LEASE_BUSY', trusted: true }]
]) {
  const { store, output } = await runWithResult(result);
  assert.equal(output.claimed, 1, `${label}: claimed`);
  assert.equal(output.uncertain, 0, `${label}: malformed executor result is deterministic`);
  assert.equal(output.invalidResults, 1, `${label}: invalid count`);
  assert.deepEqual(output.results[0], {
    scheduleId: 'sched-1',
    ok: false,
    error: SCHEDULE_EXECUTION_RESULT_INVALID,
    retryScheduled: true,
    contractInvalid: true
  }, `${label}: fail-closed result`);
  assert.equal(store.calls.some((entry) => entry[0] === 'complete'), false, `${label}: never completes`);
  assert.equal(store.calls.some((entry) => entry[0] === 'defer'), false, `${label}: never refunds attempt`);
  assert.deepEqual(store.calls.at(-1), [
    'fail',
    'sched-1',
    { error: SCHEDULE_EXECUTION_RESULT_INVALID, retryAt: '2026-08-20T17:01:00.000Z' }
  ], `${label}: ordinary bounded retry`);
}

{
  const schedule = claimed({ attempts: 2, maxAttempts: 2 });
  const { store, output } = await runWithResult({ ok: true, extra: 'nope' }, schedule);
  assert.equal(output.invalidResults, 1);
  assert.equal(output.results[0].retryScheduled, false);
  assert.deepEqual(store.calls.at(-1), [
    'fail',
    'sched-1',
    { error: SCHEDULE_EXECUTION_RESULT_INVALID }
  ]);
}

{
  const dangerous = { ok: false };
  Object.defineProperty(dangerous, 'error', {
    enumerable: true,
    get() {
      throw new Error('secret getter detail');
    }
  });
  const { store, output } = await runWithResult(dangerous);
  assert.equal(output.invalidResults, 1);
  assert.equal(JSON.stringify(output).includes('secret getter detail'), false);
  assert.equal(store.calls.some((entry) => JSON.stringify(entry).includes('secret getter detail')), false);
}

{
  const store = createStore();
  const worker = createScheduleWorker({
    store,
    registry,
    now,
    executeAgentTask: async () => {
      throw new Error('secret executor detail');
    }
  });
  const output = await worker.runDue();
  assert.equal(output.invalidResults, 0, 'executor throw remains execution failure, not contract failure');
  assert.equal(output.results[0].error, 'SCHEDULE_EXECUTION_FAILED');
  assert.equal(JSON.stringify(output).includes('secret executor detail'), false);
}

{
  const store = createStore();
  const controller = new AbortController();
  controller.abort('stop');
  let called = false;
  const worker = createScheduleWorker({
    store,
    registry,
    now,
    executeAgentTask: async () => {
      called = true;
      return { ok: true };
    }
  });
  const output = await worker.runDue({ signal: controller.signal });
  assert.equal(called, false);
  assert.equal(output.claimed, 0);
  assert.equal(output.invalidResults, undefined, 'pre-claim cancellation preserves compact response contract');
}

console.log('schedule worker result contract tests passed');
