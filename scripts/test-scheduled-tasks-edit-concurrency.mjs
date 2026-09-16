import assert from 'node:assert/strict';
import { createTaskSchedulePersistence } from '../lib/task-schedule-persistence.mjs';

let saved = null;
let saves = 0;
const adapter = {
  async load() { return saved; },
  async save(value) { saves += 1; await Promise.resolve(); saved = value; }
};
const runtime = createTaskSchedulePersistence({ adapter, storeOptions:{ now:()=>new Date('2026-09-16T12:00:00Z') } });
await runtime.open();
const task = await runtime.add({ traceId:'trace', ownerId:'u', agentId:'research', task:'base', runAt:'2026-09-16T14:00:00Z', maxAttempts:3 });
const first = runtime.update(task.scheduleId, { task:'first', runAt:'2026-09-16T15:00:00Z' });
const second = runtime.update(task.scheduleId, { task:'second', runAt:'2026-09-16T16:00:00Z' });
const results = await Promise.all([first, second]);
assert.equal(results[0].task, 'first');
assert.equal(results[1].task, 'second');
assert.equal(runtime.read(task.scheduleId).task, 'second');
assert.equal(runtime.read(task.scheduleId).runAt, '2026-09-16T16:00:00.000Z');
assert.equal(saves, 3);
console.log('scheduled task edit serialization ok');
