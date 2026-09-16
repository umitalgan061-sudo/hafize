import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

const store = createTaskScheduleStore({ now: () => new Date('2026-09-16T12:00:00Z') });
const task = store.add({ traceId:'trace', ownerId:'u', agentId:'research', task:'valid', runAt:'2026-09-16T13:00:00Z', maxAttempts:5 });
for (const input of [
  { runAt:'not-a-date' },
  { task:'' },
  { task:'x'.repeat(20_001) },
  { agentId:'' },
  { maxAttempts:0 },
  { maxAttempts:6 },
  { unknown:'field' }
]) assert.throws(() => store.update(task.scheduleId, input));
const same = store.update(task.scheduleId, { agentId:'planner' });
assert.equal(same.agentId, 'planner');
assert.equal(same.task, 'valid');
console.log('scheduled task edit validation boundaries ok');
