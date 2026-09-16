import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

const store=createTaskScheduleStore({now:()=>new Date('2026-09-16T12:00:00Z')});
const item=store.add({traceId:'trace',ownerId:'u',agentId:'research',task:'x',runAt:'2026-09-16T14:00:00Z',maxAttempts:2});
const edited=store.update(item.scheduleId,{task:'y'});
assert.equal(edited.scheduleId,item.scheduleId);
assert.equal(edited.traceId,item.traceId);
assert.equal(edited.ownerId,item.ownerId);
assert.equal(edited.createdAt,item.createdAt);
assert.ok(edited.updatedAt);
assert.equal(edited.lastError,null);
console.log('scheduled task audit invariants ok');
