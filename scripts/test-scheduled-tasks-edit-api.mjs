import assert from 'node:assert/strict';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';

const agents = [{ id: 'research' }, { id: 'planner' }];
let updated = null;
const entries = new Map([['schedule_1', { scheduleId:'schedule_1', ownerId:'user_1', status:'scheduled', agentId:'research', task:'Eski', runAt:'2026-09-17T10:00:00.000Z', attempts:0, maxAttempts:3, traceId:'trace', lastError:null, createdAt:'2026-09-16T10:00:00.000Z', updatedAt:null }]]);
const store = {
  async read(id) { return entries.get(id) || null; },
  async update(id, input) { updated = { ...entries.get(id), ...input, updatedAt:'2026-09-16T12:00:00.000Z', lastError:null }; entries.set(id, updated); return updated; },
  async snapshot() { return { entries:[...entries.values()] }; },
  async add() { throw new Error('unused'); }, async cancel() { throw new Error('unused'); }
};
const boundary = createScheduleCommandBoundary({ store, registry:{ agents }, createTraceId:() => 'trace_new' });
const principal = { authenticated:true, subject:'user_1' };
const result = await boundary.update({ principal, scheduleId:'schedule_1', input:{ agentId:'planner', task:'Yeni görev', runAt:'2026-09-17T11:00:00.000Z', maxAttempts:4 } });
assert.equal(result.ok, true);
assert.equal(result.schedule.agentId, 'planner');
assert.equal(result.schedule.task, 'Yeni görev');
assert.equal(result.schedule.maxAttempts, 4);
assert.equal((await boundary.update({ principal:{ authenticated:true, subject:'other' }, scheduleId:'schedule_1', input:{ task:'X' } })).error, 'SCHEDULE_NOT_FOUND');
assert.equal((await boundary.update({ principal, scheduleId:'schedule_404', input:{ task:'X' } })).error, 'SCHEDULE_NOT_FOUND');
assert.equal((await boundary.update({ principal, scheduleId:'schedule_1', input:{ nope:true } })).error, 'INVALID_SCHEDULE_COMMAND');
entries.get('schedule_1').status = 'completed';
assert.equal((await boundary.update({ principal, scheduleId:'schedule_1', input:{ task:'Y' } })).error, 'SCHEDULE_NOT_EDITABLE');
console.log('scheduled task patch boundary contracts ok');
