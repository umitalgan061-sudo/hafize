import assert from 'node:assert/strict';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';
import { createTaskScheduleStore, TASK_SCHEDULE_TIMING_LIMITS } from '../lib/task-schedule-store.mjs';

const now = () => new Date('2026-08-15T08:00:00.000Z');
const registry = { agents: [{ id: 'minimal-engineer', name: 'Minimal Engineer' }] };
const store = createTaskScheduleStore({ now });
const commands = createScheduleCommandBoundary({
  store,
  registry,
  createTraceId: () => 'trace-security'
});
const owner = { authenticated: true, subject: 'owner-a' };

for (const runAt of [
  '2026-08-15T12:00:00',
  '2026-08-15 12:00:00Z',
  '2026-08-15T12:00Z',
  '2026-08-15T12:00:00+99:99'
]) {
  assert.deepEqual(
    await commands.create({ principal: owner, input: { agentId: 'minimal-engineer', task: 'x', runAt } }),
    { ok: false, error: 'INVALID_SCHEDULE_COMMAND' }
  );
}

for (const retryDelayMs of [
  TASK_SCHEDULE_TIMING_LIMITS.minRetryDelayMs - 1,
  TASK_SCHEDULE_TIMING_LIMITS.maxRetryDelayMs + 1,
  1.5,
  '5000'
]) {
  assert.deepEqual(
    await commands.create({
      principal: owner,
      input: { agentId: 'minimal-engineer', task: 'x', runAt: '2026-08-15T12:00:00Z', retryDelayMs }
    }),
    { ok: false, error: 'INVALID_SCHEDULE_COMMAND' }
  );
}

const created = await commands.create({
  principal: owner,
  input: {
    agentId: 'minimal-engineer',
    task: 'immutable task',
    runAt: '2026-08-15T12:00:00+03:00',
    retryDelayMs: TASK_SCHEDULE_TIMING_LIMITS.minRetryDelayMs
  }
});
assert.equal(created.ok, true);
assert.equal(created.schedule.runAt, '2026-08-15T09:00:00.000Z');
assert.equal(created.schedule.retryDelayMs, TASK_SCHEDULE_TIMING_LIMITS.minRetryDelayMs);
assert.equal('ownerId' in created.schedule, false);

for (const injected of [
  { runAt: '2026-08-15T13:00:00Z', ownerId: 'attacker' },
  { runAt: '2026-08-15T13:00:00Z', token: 'secret' },
  { retryDelayMs: 5_000, task: 'replace task' }
]) {
  assert.deepEqual(
    await commands.reschedule({ principal: owner, scheduleId: created.schedule.scheduleId, input: injected }),
    { ok: false, error: 'INVALID_SCHEDULE_COMMAND' }
  );
}
assert.equal(store.read(created.schedule.scheduleId).task, 'immutable task');

const moved = await commands.reschedule({
  principal: owner,
  scheduleId: created.schedule.scheduleId,
  input: {
    runAt: '2026-08-16T12:30:00+03:00',
    retryDelayMs: TASK_SCHEDULE_TIMING_LIMITS.maxRetryDelayMs
  }
});
assert.equal(moved.ok, true);
assert.equal(moved.schedule.runAt, '2026-08-16T09:30:00.000Z');
assert.equal(moved.schedule.retryDelayMs, TASK_SCHEDULE_TIMING_LIMITS.maxRetryDelayMs);
assert.equal(JSON.stringify(moved).includes('owner-a'), false);

console.log('schedule user timing security tests passed');
