import assert from 'node:assert/strict';
import { createTaskSchedulePersistence } from '../lib/task-schedule-persistence.mjs';

let saved = null;
const adapter = {
  async load() { return saved; },
  async save(value) { saved = value; }
};
const persistence = createTaskSchedulePersistence({ adapter, storeOptions:{ now:()=>new Date('2026-09-16T12:00:00Z') } });
await persistence.open();
const created = await persistence.add({ traceId:'trace_1', ownerId:'u1', agentId:'research', task:'eski', runAt:'2026-09-16T13:00:00Z', maxAttempts:2 });
const updated = await persistence.update(created.scheduleId, { task:'yeni', runAt:'2026-09-16T14:00:00Z', maxAttempts:3 });
assert.equal(updated.task, 'yeni');
assert.equal(saved.schemaVersion, 1);
assert.equal(saved.snapshot.entries[0].task, 'yeni');
const reopened = createTaskSchedulePersistence({ adapter, storeOptions:{ now:()=>new Date('2026-09-16T12:00:00Z') } });
await reopened.open();
assert.equal(reopened.read(created.scheduleId).task, 'yeni');
console.log('scheduled task persistence update contracts ok');
