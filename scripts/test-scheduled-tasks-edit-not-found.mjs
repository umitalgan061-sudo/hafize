import assert from 'node:assert/strict';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';

const store={
 async read(){return null;}, async update(){throw new Error('must not update');},
 async snapshot(){return {entries:[]};}, async add(){throw new Error('unused');}, async cancel(){throw new Error('unused');}
};
const boundary=createScheduleCommandBoundary({store,registry:{agents:[{id:'research'}]},createTraceId:()=> 'trace'});
const result=await boundary.update({principal:{authenticated:true,subject:'u'},scheduleId:'schedule_missing',input:{task:'x'}});
assert.equal(result.ok,false);
assert.equal(result.error,'SCHEDULE_NOT_FOUND');
console.log('scheduled task missing edit target contract ok');
