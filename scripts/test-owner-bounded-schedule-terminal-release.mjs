import assert from 'node:assert/strict';
import { createOwnerBoundedScheduleStore } from '../lib/owner-bounded-schedule-store.mjs';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

let now = new Date('2026-08-18T08:00:00Z');
const base = createTaskScheduleStore({ now: () => now });
const store = createOwnerBoundedScheduleStore({ store: base, maxEntriesPerOwner: 1 });
const make = (suffix, runAt) => ({
  ownerId: 'alice',
  traceId: `trace-${suffix}`,
  agentId: 'minimal-engineer',
  task: `task-${suffix}`,
  runAt
});

const first = await store.add(make('first', '2026-08-18T08:01:00Z'));
await assert.rejects(store.add(make('blocked', '2026-08-18T08:02:00Z')), /TASK_SCHEDULE_FULL/);
base.cancel(first.scheduleId);
const afterCancel = await store.add(make('after-cancel', '2026-08-18T08:03:00Z'));
assert.equal(afterCancel.status, 'scheduled');

base.cancel(afterCancel.scheduleId);
const runnable = await store.add(make('runnable', '2026-08-18T08:04:00Z'));
now = new Date('2026-08-18T08:05:00Z');
const [claimed] = base.claimDue({ limit: 1 });
assert.equal(claimed.scheduleId, runnable.scheduleId);
await assert.rejects(store.add(make('while-running', '2026-08-18T08:06:00Z')), /TASK_SCHEDULE_FULL/);
base.complete(runnable.scheduleId);
const afterComplete = await store.add(make('after-complete', '2026-08-18T08:07:00Z'));
assert.equal(afterComplete.status, 'scheduled');

console.log('owner quota terminal release: ok');
