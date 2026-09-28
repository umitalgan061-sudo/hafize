import assert from 'node:assert/strict';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.ts';
const entries=[];
const store={
  add:async(input)=>{const entry={ownerId:input.ownerId,scheduleId:'s1',traceId:input.traceId,agentId:input.agentId,task:input.task,runAt:input.runAt,status:'scheduled',attempts:0,maxAttempts:1,lastError:null,createdAt:'2026-01-01T00:00:00Z',updatedAt:null,recurrence:input.recurrence,seriesId:null,seriesStartAt:null,occurrenceCount:0,history:[]};entries.push(entry);return entry;},
  read:async(id)=>entries.find(x=>x.scheduleId===id)||null,
  snapshot:async()=>({entries}),
  cancel:async()=>entries[0],
  pause:async()=>entries[0],
  resume:async()=>entries[0]
};
const boundary=createScheduleCommandBoundary({store,registry:{agents:[{id:'writer'}]},createTraceId:()=> 'trace'});
const result=await boundary.create({principal:{authenticated:true,subject:'u'},input:{agentId:'writer',task:'x',runAt:'2026-10-01T10:00:00Z',recurrence:{frequency:'daily',interval:1,unexpected:true}}});
assert.deepEqual(result,{ok:false,error:'INVALID_SCHEDULE'});
assert.deepEqual(await boundary.pause({principal:{authenticated:true,subject:'other'},scheduleId:'s1'}),{ok:false,error:'SCHEDULE_NOT_FOUND'});
console.log('schedule API security contract: ok');
