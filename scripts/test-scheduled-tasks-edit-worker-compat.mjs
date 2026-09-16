import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

let now=new Date('2026-09-16T12:00:00Z');
const store=createTaskScheduleStore({now:()=>now});
const entry=store.add({traceId:'t',ownerId:'u',agentId:'research',task:'original',runAt:'2026-09-16T13:00:00Z',maxAttempts:2});
store.update(entry.scheduleId,{task:'edited',runAt:'2026-09-16T14:00:00Z'});
now=new Date('2026-09-16T14:00:00Z');
const claimed=store.claimDue();
assert.equal(claimed.length,1);
assert.equal(claimed[0].task,'edited');
assert.equal(claimed[0].status,'running');
assert.equal(claimed[0].attempts,1);
console.log('scheduled task worker compatibility ok');
