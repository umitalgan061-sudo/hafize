import assert from 'node:assert/strict';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';

const entry={scheduleId:'schedule_1',traceId:'trace',ownerId:'owner',agentId:'research',task:'task',runAt:'2026-09-17T10:00:00Z',status:'scheduled',attempts:0,maxAttempts:2,lastError:null,createdAt:'2026-09-16T10:00:00Z',updatedAt:null};
const store={async read(){return entry;},async update(){return entry;},async snapshot(){return {entries:[entry]};},async add(){return entry;},async cancel(){return entry;}};
const api=createScheduleCommandBoundary({store,registry:{agents:[{id:'research'}]},createTraceId:()=> 'trace2'});
const result=await api.update({principal:{authenticated:true,subject:'owner'},scheduleId:'schedule_1',input:{task:'new'}});
assert.equal(result.ok,true);
assert.equal('ownerId' in result.schedule,false);
assert.equal(result.schedule.traceId,'trace');
console.log('scheduled task public response privacy contract ok');
