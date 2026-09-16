import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

const clock = { value: new Date('2026-09-16T12:00:00Z') };
const store = createTaskScheduleStore({ now: () => clock.value });
const item = store.add({ traceId:'trace', ownerId:'u1', agentId:'research', task:'A', runAt:'2026-09-16T13:00:00Z', maxAttempts:3 });
const edited = store.update(item.scheduleId, { task:'B', agentId:'planner', runAt:'2026-09-16T13:30:00Z', maxAttempts:4 });
assert.equal(edited.status, 'scheduled');
assert.equal(edited.attempts, 0);
assert.equal(edited.lastError, null);
assert.equal(edited.ownerId, 'u1');
assert.equal(edited.traceId, 'trace');
assert.equal(edited.createdAt, item.createdAt);
clock.value = new Date('2026-09-16T13:00:00Z');
assert.equal(store.claimDue()[0].scheduleId, item.scheduleId);
console.log('scheduled task edit state invariants ok');
