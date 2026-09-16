import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

let now = new Date('2026-09-16T12:00:00Z');
const store = createTaskScheduleStore({ now:()=>now });
const item = store.add({ traceId:'trace', ownerId:'u', agentId:'research', task:'x', runAt:'2026-09-16T14:00:00Z', maxAttempts:4 });
const snapshot = store.snapshot();
snapshot.entries[0].status = 'running';
snapshot.entries[0].attempts = 2;
const running = createTaskScheduleStore({ now:()=>now, initialSnapshot:snapshot });
assert.throws(() => running.update(item.scheduleId,{ maxAttempts:2 }), /INVALID_TASK_SCHEDULE_TRANSITION/);
assert.throws(() => store.update(item.scheduleId,{ maxAttempts:0 }), /INVALID_TASK_SCHEDULE:maxAttempts/);
assert.equal(store.update(item.scheduleId,{ maxAttempts:4 }).maxAttempts,4);
console.log('scheduled task attempt edit floor ok');
