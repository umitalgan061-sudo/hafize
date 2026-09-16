import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

for(const status of ['running','completed','failed','cancelled']){
 const snapshot={entries:[{scheduleId:'schedule_1',traceId:'t',ownerId:'u',agentId:'research',task:'x',runAt:'2026-09-20T10:00:00Z',status,attempts:status==='running'||status==='completed'||status==='failed'?1:0,maxAttempts:2,lastError:null,createdAt:'2026-09-16T10:00:00Z',updatedAt:null}]};
 const store=createTaskScheduleStore({now:()=>new Date('2026-09-16T12:00:00Z'),initialSnapshot:snapshot});
 assert.throws(()=>store.update('schedule_1',{task:'changed'}),/INVALID_TASK_SCHEDULE_TRANSITION/);
}
console.log('scheduled task non-editable status guard ok');
