import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

let current = new Date('2026-08-12T09:00:00.000Z');
const now = () => new Date(current.getTime());
const store = createTaskScheduleStore({ maxEntries: 2, now });

assert.throws(
  () => store.add({
    traceId: 'trace-secret',
    agentId: 'hafize-general',
    task: 'test',
    runAt: '2026-08-12T08:59:00.000Z',
    token: 'must-not-persist'
  }),
  /INVALID_TASK_SCHEDULE:field/
);
assert.equal(JSON.stringify(store.snapshot()).includes('must-not-persist'), false);

const first = store.add({
  traceId: 'trace-schedule-1',
  agentId: 'hafize-general',
  task: 'Saatlik durumu özetle.',
  runAt: '2026-08-12T08:59:00.000Z',
  maxAttempts: 2
});
assert.equal(first.status, 'scheduled');
assert.equal(first.attempts, 0);
assert.equal(first.maxAttempts, 2);

const immutable = store.snapshot();
immutable.entries[0].task = 'changed outside';
assert.equal(store.read(first.scheduleId).task, 'Saatlik durumu özetle.');

const claimed = store.claimDue({ limit: 4 });
assert.equal(claimed.length, 1);
assert.equal(claimed[0].scheduleId, first.scheduleId);
assert.equal(claimed[0].status, 'running');
assert.equal(claimed[0].attempts, 1);
assert.deepEqual(store.claimDue(), []);

const retried = store.fail(first.scheduleId, {
  error: 'NVIDIA_CHAT_ERROR',
  retryAt: '2026-08-12T09:05:00.000Z'
});
assert.equal(retried.status, 'scheduled');
assert.equal(retried.lastError, 'NVIDIA_CHAT_ERROR');
assert.equal(retried.runAt, '2026-08-12T09:05:00.000Z');

current = new Date('2026-08-12T09:05:00.000Z');
const retryClaim = store.claimDue();
assert.equal(retryClaim.length, 1);
assert.equal(retryClaim[0].attempts, 2);
const terminal = store.fail(first.scheduleId, {
  error: 'NVIDIA_CHAT_ERROR',
  retryAt: '2026-08-12T09:10:00.000Z'
});
assert.equal(terminal.status, 'failed');
assert.equal(terminal.attempts, 2);

const second = store.add({
  traceId: 'trace-schedule-2',
  agentId: 'agency-code-reviewer',
  task: 'PR durumunu kontrol et.',
  runAt: '2026-08-12T10:00:00.000Z',
  maxAttempts: 99
});
assert.equal(second.maxAttempts, 5);
assert.equal(store.cancel(second.scheduleId).status, 'cancelled');

assert.throws(
  () => store.add({ traceId: 'trace-3', agentId: 'hafize-general', task: 'fazla', runAt: current }),
  /TASK_SCHEDULE_FULL/
);
assert.throws(() => store.complete(second.scheduleId), /INVALID_TASK_SCHEDULE_TRANSITION/);

const ordering = createTaskScheduleStore({ now });
const later = ordering.add({
  traceId: 'trace-later', agentId: 'hafize-general', task: 'later', runAt: '2026-08-12T09:04:00.000Z'
});
const earlier = ordering.add({
  traceId: 'trace-earlier', agentId: 'hafize-general', task: 'earlier', runAt: '2026-08-12T09:03:00.000Z'
});
const one = ordering.claimDue({ limit: 1 });
assert.equal(one[0].scheduleId, earlier.scheduleId);
assert.equal(ordering.read(later.scheduleId).status, 'scheduled');

const invalid = createTaskScheduleStore({ now });
assert.throws(
  () => invalid.add({ traceId: 't', agentId: 'a', task: 'x', runAt: 'not-a-date' }),
  /INVALID_TASK_SCHEDULE:runAt/
);
const invalidRetry = invalid.add({
  traceId: 'retry', agentId: 'a', task: 'x', runAt: '2026-08-12T09:00:00.000Z', maxAttempts: 2
});
invalid.claimDue();
assert.throws(
  () => invalid.fail(invalidRetry.scheduleId, { error: 'retry_failed', retryAt: '2026-08-12T09:05:00.000Z' }),
  /INVALID_TASK_SCHEDULE:error/
);
assert.throws(
  () => invalid.fail(invalidRetry.scheduleId, { error: 'RETRY_FAILED', retryAt: '2026-08-12T09:05:00.000Z' }),
  /INVALID_TASK_SCHEDULE:retryAt/
);
assert.equal(invalid.read(invalidRetry.scheduleId).status, 'running');
assert.equal(invalid.read(invalidRetry.scheduleId).lastError, null);

console.log('task schedule store tests passed');
