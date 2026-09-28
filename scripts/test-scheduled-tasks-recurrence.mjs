import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

let now = new Date('2026-09-28T08:30:00Z');
const store = createTaskScheduleStore({ now: () => now, maxEntries: 8 });
const base = {
  traceId: 'trace-1', ownerId: 'user-1', agentId: 'writer',
  task: 'Günlük raporu hazırla', runAt: '2026-09-28T08:00:00Z',
  maxAttempts: 2, recurrence: { frequency: 'daily', interval: 1 }
};
const created = store.add(base);
assert.equal(created.status,'scheduled');
assert.equal(created.recurrence.frequency,'daily');
assert.equal(created.occurrenceCount,0);
assert.equal(created.history.length,0);

const claimed = store.claimDue({limit:1});
assert.equal(claimed.length,1);
assert.equal(claimed[0].attempts,1);
const completed = store.complete(created.scheduleId);
assert.equal(completed.status,'scheduled');
assert.equal(completed.attempts,0);
assert.equal(completed.occurrenceCount,1);
assert.equal(completed.history[0].status,'completed');
assert.equal(completed.runAt,'2026-09-29T08:00:00.000Z');

now = new Date('2026-09-29T08:01:00Z');
const second = store.claimDue({limit:1})[0];
assert.equal(second.scheduleId,created.scheduleId);
store.fail(created.scheduleId,{error:'SCHEDULE_EXECUTION_FAILED'});
const afterFailure = store.read(created.scheduleId);
assert.equal(afterFailure.status,'scheduled');
assert.equal(afterFailure.occurrenceCount,2);
assert.equal(afterFailure.history[0].status,'failed');

assert.equal(store.pause(created.scheduleId).status,'paused');
assert.equal(store.claimDue({limit:1}).length,0);
assert.equal(store.resume(created.scheduleId).status,'scheduled');
assert.equal(store.cancel(created.scheduleId).status,'cancelled');
assert.equal(store.claimDue({limit:1}).length,0);
console.log('scheduled recurrence lifecycle: ok');
