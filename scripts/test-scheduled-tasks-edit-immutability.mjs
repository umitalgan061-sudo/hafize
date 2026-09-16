import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

const store=createTaskScheduleStore({now:()=>new Date('2026-09-16T12:00:00Z')});
const item=store.add({traceId:'trace',ownerId:'owner',agentId:'research',task:'task',runAt:'2026-09-16T15:00:00Z',maxAttempts:2});
const edited=store.update(item.scheduleId,{task:'task 2'});
for(const key of ['scheduleId','traceId','ownerId','createdAt']) assert.equal(edited[key],item[key]);
assert.equal(edited.status,'scheduled');
console.log('scheduled task identity immutability ok');
