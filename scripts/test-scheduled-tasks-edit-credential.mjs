import assert from 'node:assert/strict';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';

const entry = { scheduleId:'schedule_1', ownerId:'u1', status:'scheduled', agentId:'research', task:'güvenli', runAt:'2026-09-17T10:00:00Z', attempts:0, maxAttempts:3, traceId:'trace', lastError:null, createdAt:'2026-09-16T10:00:00Z', updatedAt:null };
let updates = 0;
const store = {
 async read(){ return { ...entry }; },
 async update(){ updates += 1; return { ...entry }; },
 async snapshot(){ return { entries:[entry] }; }, async add(){ return entry; }, async cancel(){ return entry; }
};
const boundary = createScheduleCommandBoundary({ store, registry:{ agents:[{ id:'research' }] }, createTraceId:()=> 'trace_new' });
const principal = { authenticated:true, subject:'u1' };
const result = await boundary.update({ principal, scheduleId:'schedule_1', input:{ task:'API key: abcdefghijklmnopqrstuvwxyz' } });
assert.equal(result.error, 'SCHEDULE_TASK_CREDENTIAL_NOT_ALLOWED');
assert.equal(updates, 0);
console.log('scheduled task credential edit guard ok');
