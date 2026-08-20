import assert from 'node:assert/strict';
import { createScheduleWorker, validateClaimedBatch } from '../lib/schedule-worker.mjs';

const registry = Object.freeze({
  agents: Object.freeze([Object.freeze({ id: 'minimal-engineer', name: 'Minimal Engineer' })])
});

function validSchedule(id = 'schedule_1', overrides = {}) {
  return {
    scheduleId: id,
    traceId: `trace-${id}`,
    agentId: 'minimal-engineer',
    task: 'bounded scheduled task',
    attempts: 1,
    maxAttempts: 2,
    retryDelayMs: 60_000,
    ...overrides
  };
}

{
  const first = validSchedule('schedule_1');
  const second = validSchedule('schedule_2');
  assert.equal(validateClaimedBatch([first, second], 2).length, 2);
  assert.throws(() => validateClaimedBatch('bad', 2), /INVALID_SCHEDULE_WORKER:claimed/);
  assert.throws(() => validateClaimedBatch([first, second], 1), /claim_limit_exceeded/);
  assert.throws(() => validateClaimedBatch([first, { ...second, scheduleId: first.scheduleId }], 2), /duplicate_schedule_id/);
  assert.throws(() => validateClaimedBatch([null], 1), /claimed_schedule/);
  assert.throws(() => validateClaimedBatch([[]], 1), /claimed_schedule/);
}

{
  const cases = [
    [validSchedule(' schedule_1'), 'claimed_schedule_id'],
    [validSchedule('schedule_1', { scheduleId: '' }), 'claimed_schedule_id'],
    [validSchedule('schedule_1', { traceId: ' trace' }), 'claimed_trace_id'],
    [validSchedule('schedule_1', { traceId: '' }), 'claimed_trace_id'],
    [validSchedule('schedule_1', { agentId: ' minimal-engineer' }), 'claimed_agent_id'],
    [validSchedule('schedule_1', { agentId: '' }), 'claimed_agent_id'],
    [validSchedule('schedule_1', { task: ' task' }), 'claimed_task'],
    [validSchedule('schedule_1', { task: '' }), 'claimed_task'],
    [validSchedule('schedule_1', { attempts: 0 }), 'claimed_attempts'],
    [validSchedule('schedule_1', { attempts: 1.5 }), 'claimed_attempts'],
    [validSchedule('schedule_1', { maxAttempts: 0 }), 'claimed_max_attempts'],
    [validSchedule('schedule_1', { attempts: 2, maxAttempts: 1 }), 'claimed_max_attempts']
  ];
  for (const [schedule, code] of cases) {
    assert.throws(() => validateClaimedBatch([schedule], 1), new RegExp(`INVALID_SCHEDULE_WORKER:${code}`));
  }
}

{
  let executions = 0;
  let completions = 0;
  let failures = 0;
  const duplicate = validSchedule('schedule_7');
  const store = {
    async claimDue() {
      return [duplicate, { ...duplicate }];
    },
    async complete() {
      completions += 1;
    },
    async fail() {
      failures += 1;
    }
  };
  const worker = createScheduleWorker({
    store,
    registry,
    maxBatch: 2,
    maxConcurrency: 2,
    async executeAgentTask() {
      executions += 1;
      return { ok: true };
    }
  });
  await assert.rejects(worker.runDue(), /INVALID_SCHEDULE_WORKER:duplicate_schedule_id/);
  assert.equal(executions, 0, 'duplicate schedule IDs are rejected before any agent task can run');
  assert.equal(completions, 0);
  assert.equal(failures, 0);
}

{
  let executions = 0;
  const malformed = validSchedule('schedule_8', { attempts: 0 });
  const store = {
    async claimDue() {
      return [malformed, validSchedule('schedule_9')];
    },
    async complete() {},
    async fail() {}
  };
  const worker = createScheduleWorker({
    store,
    registry,
    maxBatch: 2,
    async executeAgentTask() {
      executions += 1;
      return { ok: true };
    }
  });
  await assert.rejects(worker.runDue(), /INVALID_SCHEDULE_WORKER:claimed_attempts/);
  assert.equal(executions, 0, 'whole claimed batch validates before concurrency lanes start');
}

{
  let requestedLimit = null;
  const store = {
    async claimDue({ limit }) {
      requestedLimit = limit;
      return [validSchedule('schedule_10')];
    },
    async complete() {},
    async fail() {}
  };
  let executions = 0;
  const worker = createScheduleWorker({
    store,
    registry,
    maxBatch: 3,
    maxConcurrency: 2,
    async executeAgentTask(input) {
      executions += 1;
      assert.equal(input.scheduleId, 'schedule_10');
      return { ok: true };
    }
  });
  const result = await worker.runDue({ limit: 64 });
  assert.equal(requestedLimit, 3, 'claim boundary remains capped by configured max batch');
  assert.equal(executions, 1);
  assert.equal(result.claimed, 1);
  assert.equal(result.uncertain, 0);
  assert.deepEqual(result.results[0], { scheduleId: 'schedule_10', ok: true });
}

console.log('schedule worker claim boundary tests passed');
