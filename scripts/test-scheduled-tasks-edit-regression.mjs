import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

let now = new Date('2026-09-16T12:00:00Z');
const store = createTaskScheduleStore({ now:()=>now, maxEntries:4 });
const a = store.add({traceId:'a',ownerId:'u',agentId:'research',task:'a',runAt:'2026-09-16T13:00:00Z',maxAttempts:2});
const b = store.add({traceId:'b',ownerId:'u',agentId:'planner',task:'b',runAt:'2026-09-16T14:00:00Z',maxAttempts:1});
const before = store.snapshot();
const updated = store.update(a.scheduleId,{task:'a2'});
assert.equal(updated.scheduleId,a.scheduleId);
assert.equal(updated.createdAt,before.entries[0].createdAt);
assert.equal(store.read(b.scheduleId).task,'b');
assert.equal(store.snapshot().entries.length,2);
now = new Date('2026-09-16T12:30:00Z');
const again = store.update(a.scheduleId,{runAt:'2026-09-16T18:00:00Z'});
assert.equal(again.attempts,0);
assert.equal(again.status,'scheduled');
console.log('scheduled task edit regression invariants ok');
