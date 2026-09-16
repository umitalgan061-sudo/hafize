import assert from 'node:assert/strict';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';

const store = {
  async read(){ return { scheduleId:'schedule_1', ownerId:'owner', status:'scheduled', agentId:'research', task:'t', runAt:'2026-09-17T10:00:00Z', attempts:0, maxAttempts:2 }; },
  async update(){ throw new Error('must not update'); },
  async snapshot(){ return { entries:[] }; },
  async add(){ throw new Error('unused'); },
  async cancel(){ throw new Error('unused'); }
};
const boundary = createScheduleCommandBoundary({ store, registry:{ agents:[{id:'research'}] }, createTraceId:()=> 'trace' });
assert.equal((await boundary.update({ principal:null, scheduleId:'schedule_1', input:{ task:'x' } })).error, 'AUTH_REQUIRED');
assert.equal((await boundary.update({ principal:{ authenticated:false, subject:'owner' }, scheduleId:'schedule_1', input:{ task:'x' } })).error, 'AUTH_REQUIRED');
assert.equal((await boundary.update({ principal:{ authenticated:true, subject:'' }, scheduleId:'schedule_1', input:{ task:'x' } })).error, 'AUTH_REQUIRED');
console.log('scheduled task edit auth contracts ok');
