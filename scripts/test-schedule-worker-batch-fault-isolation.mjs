import assert from 'node:assert/strict';
import {
  createScheduleWorker,
  WORKER_STATE_UNCERTAIN_ERROR
} from '../lib/schedule-worker.mjs';

const registry = Object.freeze({
  agents: Object.freeze([
    Object.freeze({ id: 'minimal-engineer', name: 'Minimal Engineer' })
  ])
});

function claimedSchedule(id, overrides = {}) {
  return Object.freeze({
    scheduleId: id,
    traceId: `trace-${id}`,
    agentId: 'minimal-engineer',
    task: `task ${id}`,
    attempts: 1,
    maxAttempts: 1,
    retryDelayMs: 60_000,
    ...overrides
  });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

{
  const schedules = [
    claimedSchedule('schedule_1'),
    claimedSchedule('schedule_2'),
    claimedSchedule('schedule_3')
  ];
  const slow = deferred();
  const executed = [];
  const completed = [];
  let middleCompleteReached = false;

  const store = {
    async claimDue({ limit }) {
      assert.equal(limit, 3);
      return schedules;
    },
    async complete(scheduleId) {
      completed.push(scheduleId);
      if (scheduleId === 'schedule_2') {
        middleCompleteReached = true;
        throw new Error('secret durable store failure');
      }
    },
    async fail() {
      throw new Error('unexpected fail call');
    }
  };

  const worker = createScheduleWorker({
    store,
    registry,
    maxBatch: 3,
    maxConcurrency: 2,
    async executeAgentTask({ scheduleId }) {
      executed.push(scheduleId);
      if (scheduleId === 'schedule_1') await slow.promise;
      return { ok: true };
    }
  });

  const pending = worker.runDue({ limit: 3 });
  for (let spin = 0; spin < 20 && !middleCompleteReached; spin += 1) await Promise.resolve();
  assert.equal(middleCompleteReached, true, 'failing lane reaches post-execution persistence');
  assert.deepEqual(executed.slice(0, 2), ['schedule_1', 'schedule_2']);

  for (let spin = 0; spin < 20 && !executed.includes('schedule_3'); spin += 1) await Promise.resolve();
  assert.equal(executed.includes('schedule_3'), true, 'same lane continues to remaining schedule after isolated fault');
  assert.equal(completed.includes('schedule_3'), true, 'neighbor schedule can persist before slow lane finishes');

  let settled = false;
  pending.finally(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false, 'runDue waits for every concurrency lane before returning batch result');
  slow.resolve();

  const result = await pending;
  assert.equal(result.claimed, 3);
  assert.equal(result.cancelled, false);
  assert.equal(result.uncertain, 1);
  assert.deepEqual(result.results.map((entry) => entry.scheduleId), [
    'schedule_1',
    'schedule_2',
    'schedule_3'
  ], 'result order follows claim order even when lane completion order differs');
  assert.deepEqual(result.results[0], { scheduleId: 'schedule_1', ok: true });
  assert.deepEqual(result.results[1], {
    scheduleId: 'schedule_2',
    ok: false,
    error: WORKER_STATE_UNCERTAIN_ERROR,
    outcomeUnknown: true
  });
  assert.deepEqual(result.results[2], { scheduleId: 'schedule_3', ok: true });
  assert.equal(JSON.stringify(result).includes('secret durable store failure'), false, 'internal storage detail never enters batch result');
}

{
  const schedules = [
    claimedSchedule('schedule_10', { agentId: 'missing-agent' }),
    claimedSchedule('schedule_11')
  ];
  const executed = [];
  const store = {
    async claimDue() {
      return schedules;
    },
    async complete() {},
    async fail(scheduleId) {
      if (scheduleId === 'schedule_10') throw new Error('secret missing-agent persistence failure');
    }
  };
  const worker = createScheduleWorker({
    store,
    registry,
    maxBatch: 2,
    maxConcurrency: 1,
    async executeAgentTask({ scheduleId }) {
      executed.push(scheduleId);
      return { ok: true };
    }
  });
  const result = await worker.runDue();
  assert.equal(result.uncertain, 1);
  assert.equal(result.results[0].error, WORKER_STATE_UNCERTAIN_ERROR);
  assert.equal(result.results[0].outcomeUnknown, true);
  assert.deepEqual(executed, ['schedule_11'], 'missing agent never executes even when its failure state cannot persist');
  assert.equal(result.results[1].ok, true);
  assert.equal(JSON.stringify(result).includes('secret missing-agent persistence failure'), false);
}

{
  let executed = 0;
  const store = {
    async claimDue() {
      throw new Error('SCHEDULE_PERSISTENCE_SAVE_FAILED');
    },
    async complete() {},
    async fail() {}
  };
  const worker = createScheduleWorker({
    store,
    registry,
    async executeAgentTask() {
      executed += 1;
      return { ok: true };
    }
  });
  await assert.rejects(worker.runDue(), /SCHEDULE_PERSISTENCE_SAVE_FAILED/);
  assert.equal(executed, 0, 'claim failure remains fail-closed before any scheduled task can run');
}

{
  const schedule = claimedSchedule('schedule_20', { attempts: 1, maxAttempts: 2 });
  const store = {
    async claimDue() {
      return [schedule];
    },
    async complete() {},
    async fail() {
      throw new Error('secret fail persistence detail');
    }
  };
  const worker = createScheduleWorker({
    store,
    registry,
    async executeAgentTask() {
      throw new Error('secret task exception detail');
    }
  });
  const result = await worker.runDue();
  assert.equal(result.uncertain, 1);
  assert.equal(result.results[0].error, WORKER_STATE_UNCERTAIN_ERROR);
  assert.equal(result.results[0].outcomeUnknown, true);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('secret task exception detail'), false);
  assert.equal(serialized.includes('secret fail persistence detail'), false);
}

{
  const controller = new AbortController();
  controller.abort('automation shutdown');
  let claims = 0;
  const store = {
    async claimDue() {
      claims += 1;
      return [];
    },
    async complete() {},
    async fail() {}
  };
  const worker = createScheduleWorker({
    store,
    registry,
    executeAgentTask: async () => ({ ok: true })
  });
  const result = await worker.runDue({ signal: controller.signal });
  assert.deepEqual(result, {
    claimed: 0,
    results: [],
    cancelled: true,
    uncertain: 0,
    limits: { batch: 8, concurrency: 2 }
  });
  assert.equal(claims, 0, 'pre-aborted worker does not claim schedules');
}

console.log('schedule worker batch fault isolation tests passed');
