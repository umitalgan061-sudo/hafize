import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

const store=createTaskScheduleStore({now:()=>new Date('2026-09-16T12:00:00Z')});
const item=store.add({traceId:'t',ownerId:'u',agentId:'research',task:'x',runAt:'2026-09-16T13:00:00Z',maxAttempts:2});
for(const key of ['ownerId','traceId','scheduleId','status','attempts','createdAt','updatedAt']) assert.throws(()=>store.update(item.scheduleId,{[key]:'changed'}));
assert.equal(store.update(item.scheduleId,{task:'ok'}).task,'ok');
console.log('scheduled task patch field allowlist ok');
