import assert from 'node:assert/strict';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

let nowMs = Date.parse('2026-08-16T19:00:00.000Z');
const now = () => new Date(nowMs);
const store = createTaskScheduleStore({ now });
const registry = { agents: [{ id: 'minimal-engineer' }] };
let traceCounter = 0;
const commands = createScheduleCommandBoundary({
  store,
  registry,
  createTraceId: () => `trace_${++traceCounter}`
});
const alice = { authenticated: true, subject: 'alice' };
const bob = { authenticated: true, subject: 'bob' };

const created = await commands.create({
  principal: alice,
  input: {
    agentId: 'minimal-engineer',
    task: 'Güvenli saatlik görevi çalıştır',
    runAt: '2026-08-16T20:00:00Z',
    maxAttempts: 3
  }
});
assert.equal(created.ok, true);
assert.equal(created.schedule.retryDelayMs, 60_000);
const id = created.schedule.scheduleId;

for (const retryDelayMs of [60_000, 300_000, 900_000, 3_600_000, 21_600_000, 86_400_000]) {
  const changed = await commands.reschedule({ principal: alice, scheduleId: id, input: { retryDelayMs } });
  assert.equal(changed.ok, true, `allowlisted UI delay ${retryDelayMs} must remain backend-valid`);
  assert.equal(changed.schedule.retryDelayMs, retryDelayMs);
  assert.equal(changed.schedule.status, 'scheduled');
  assert.equal(changed.schedule.attempts, 0);
}

const foreign = await commands.reschedule({ principal: bob, scheduleId: id, input: { retryDelayMs: 300_000 } });
assert.deepEqual(foreign, { ok: false, error: 'SCHEDULE_NOT_FOUND' });
const missingAuth = await commands.reschedule({ principal: null, scheduleId: id, input: { retryDelayMs: 300_000 } });
assert.deepEqual(missingAuth, { ok: false, error: 'AUTH_REQUIRED' });
const extraField = await commands.reschedule({
  principal: alice,
  scheduleId: id,
  input: { retryDelayMs: 300_000, ownerId: 'bob' }
});
assert.deepEqual(extraField, { ok: false, error: 'INVALID_SCHEDULE_COMMAND' });
const tooShort = await commands.reschedule({ principal: alice, scheduleId: id, input: { retryDelayMs: 999 } });
assert.deepEqual(tooShort, { ok: false, error: 'INVALID_SCHEDULE_COMMAND' });
const tooLong = await commands.reschedule({ principal: alice, scheduleId: id, input: { retryDelayMs: 86_400_001 } });
assert.deepEqual(tooLong, { ok: false, error: 'INVALID_SCHEDULE_COMMAND' });

nowMs = Date.parse('2026-08-16T20:01:00.000Z');
const claimed = store.claimDue();
assert.equal(claimed.length, 1);
assert.equal(claimed[0].status, 'running');
const runningChange = await commands.reschedule({ principal: alice, scheduleId: id, input: { retryDelayMs: 300_000 } });
assert.deepEqual(runningChange, { ok: false, error: 'SCHEDULE_NOT_RESCHEDULABLE' });

const failed = store.fail(id, { error: 'SIMULATED_FAILURE', retryAt: '2026-08-16T20:06:00Z' });
assert.equal(failed.status, 'scheduled');
assert.equal(failed.retryDelayMs, 86_400_000, 'retry policy remains stored across a failed attempt');
assert.equal(failed.lastError, 'SIMULATED_FAILURE');

console.log('schedule retry policy command tests passed');
