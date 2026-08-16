import assert from 'node:assert/strict';
import { createTaskScheduleStore, TASK_SCHEDULE_TIMING_LIMITS } from '../lib/task-schedule-store.mjs';
import { createScheduleCommandBoundary, SCHEDULE_COMMAND_LIMITS } from '../lib/schedule-command-boundary.mjs';

const store = createTaskScheduleStore({ now: () => new Date('2026-08-16T20:00:00Z') });
let trace = 0;
const commands = createScheduleCommandBoundary({
  store,
  registry: { agents: [{ id: 'a'.repeat(SCHEDULE_COMMAND_LIMITS.maxAgentIdChars) }] },
  createTraceId: () => `trace-edge-${++trace}`
});
const principal = { authenticated: true, subject: 's'.repeat(SCHEDULE_COMMAND_LIMITS.maxSubjectChars) };
const agentId = 'a'.repeat(SCHEDULE_COMMAND_LIMITS.maxAgentIdChars);

const accepted = await commands.create({
  principal,
  input: {
    agentId,
    task: 'x'.repeat(SCHEDULE_COMMAND_LIMITS.maxTaskChars),
    runAt: '2026-08-17T00:00:00.000Z',
    maxAttempts: SCHEDULE_COMMAND_LIMITS.maxMaxAttempts,
    retryDelayMs: TASK_SCHEDULE_TIMING_LIMITS.maxRetryDelayMs
  }
});
assert.equal(accepted.ok, true);
assert.equal(accepted.schedule.task.length, SCHEDULE_COMMAND_LIMITS.maxTaskChars);
assert.equal(accepted.schedule.maxAttempts, 5);
assert.equal(accepted.schedule.retryDelayMs, TASK_SCHEDULE_TIMING_LIMITS.maxRetryDelayMs);

assert.deepEqual(
  await commands.create({
    principal: { authenticated: true, subject: 's'.repeat(SCHEDULE_COMMAND_LIMITS.maxSubjectChars + 1) },
    input: { agentId, task: 'x', runAt: '2026-08-17T00:00:00Z' }
  }),
  { ok: false, error: 'AUTH_REQUIRED' }
);
assert.deepEqual(
  await commands.create({
    principal,
    input: { agentId, task: 'x'.repeat(SCHEDULE_COMMAND_LIMITS.maxTaskChars + 1), runAt: '2026-08-17T00:00:00Z' }
  }),
  { ok: false, error: 'INVALID_SCHEDULE_COMMAND' }
);
assert.deepEqual(
  await commands.create({
    principal,
    input: { agentId: `${agentId}x`, task: 'x', runAt: '2026-08-17T00:00:00Z' }
  }),
  { ok: false, error: 'INVALID_SCHEDULE_COMMAND' }
);
assert.deepEqual(
  await commands.create({
    principal,
    input: {
      agentId,
      task: 'x',
      runAt: '2026-08-17T00:00:00Z',
      retryDelayMs: TASK_SCHEDULE_TIMING_LIMITS.maxRetryDelayMs + 1
    }
  }),
  { ok: false, error: 'INVALID_SCHEDULE_COMMAND' }
);

assert.equal(store.snapshot().entries.length, 1, 'only exact-limit valid input may persist');
assert.equal(trace, 1, 'rejected edge cases must not allocate trace ids');

console.log('schedule command exact limit edge tests passed');
