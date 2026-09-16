import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

let now = new Date('2026-09-16T12:00:00.000Z');
const store = createTaskScheduleStore({ now: () => now });
const registry = { agents: [{ id:'research' }, { id:'planner' }] };
let traceCounter = 0;
const boundary = createScheduleCommandBoundary({ store, registry, createTraceId: () => `trace_${++traceCounter}` });
const principal = { authenticated:true, subject:'u1' };

const created = await boundary.create({ principal, input:{ agentId:'research', task:'Araştır', runAt:'2026-09-16T13:00:00Z', maxAttempts:3 } });
assert.equal(created.ok,true);
const id = created.schedule.scheduleId;

const updated = await boundary.update({ principal, scheduleId:id, input:{ agentId:'planner', task:'Araştır ve planla', runAt:'2026-09-16T14:00:00Z', maxAttempts:4 } });
assert.equal(updated.ok,true);
assert.equal(updated.schedule.scheduleId,id);
assert.equal(updated.schedule.agentId,'planner');
assert.equal(updated.schedule.task,'Araştır ve planla');
assert.equal(updated.schedule.maxAttempts,4);
assert.equal(updated.schedule.status,'scheduled');

const listed = await boundary.list({ principal });
assert.equal(listed.schedules.length,1);
assert.equal(listed.schedules[0].task,'Araştır ve planla');
assert.equal('ownerId' in listed.schedules[0],false);

const api = createScheduleHttpApi({
  authenticator:{ authenticate:()=>({ok:true,principal}) },
  commands:{ create:(v)=>boundary.create(v), list:(v)=>boundary.list(v), update:(v)=>boundary.update(v), cancel:(v)=>boundary.cancel(v) },
  readJson:async(req)=>req.body
});

const patch = await api.handle({ method:'PATCH', pathname:`/api/schedules/${id}`, headers:{}, request:{body:{runAt:'2026-09-16T15:00:00Z'}} });
assert.equal(patch.status,200);
assert.equal(patch.body.schedule.runAt,'2026-09-16T15:00:00.000Z');

const outsider = await api.handle({ method:'PATCH', pathname:`/api/schedules/${id}`, headers:{}, request:{body:{task:'gizli'}} });
assert.equal(outsider.status,200);
assert.equal(outsider.body.schedule.task,'gizli');

const badMethod = await api.handle({ method:'PUT', pathname:`/api/schedules/${id}`, headers:{}, request:{body:{}} });
assert.equal(badMethod.status,405);
assert.match(badMethod.headers.Allow,/PATCH/);

now = new Date('2026-09-16T15:01:00Z');
const due = store.claimDue();
assert.equal(due.length,1);
assert.equal(due[0].task,'gizli');
assert.equal(due[0].status,'running');

const blocked = await boundary.update({ principal, scheduleId:id, input:{ task:'çalışırken değişmez' } });
assert.equal(blocked.error,'SCHEDULE_NOT_EDITABLE');

console.log('scheduled task edit end-to-end contract ok');
