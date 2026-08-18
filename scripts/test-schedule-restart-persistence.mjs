import assert from 'node:assert/strict';
import { createTaskSchedulePersistence } from '../lib/task-schedule-persistence.mjs';

const running = {
  scheduleId: 'schedule_1', traceId: 'trace_1', ownerId: 'owner', agentId: 'minimal-engineer', task: 'resume me',
  runAt: '2026-08-18T01:00:00.000Z', status: 'running', attempts: 1, maxAttempts: 2,
  retryDelayMs: 60_000, lastError: null, createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-18T01:00:00.000Z'
};
const scheduled = {
  ...running, scheduleId: 'schedule_2', status: 'scheduled', attempts: 0, lastError: null
};
let saved = null;
const adapter = {
  async load() { return { schemaVersion: 1, snapshot: { entries: [running, scheduled] } }; },
  async save(value) { saved = value; }
};
const persistence = createTaskSchedulePersistence({ adapter });
const opened = await persistence.open();
assert.equal(opened.entries[0].status, 'scheduled');
assert.equal(opened.entries[0].attempts, 0);
assert.equal(opened.entries[0].lastError, 'SCHEDULE_PROCESS_RESTARTED');
assert.equal(opened.entries[1].status, 'scheduled');
assert.ok(saved);
assert.equal(saved.schemaVersion, 1);
assert.equal(saved.snapshot.entries[0].status, 'scheduled');
assert.equal(saved.snapshot.entries[0].attempts, 0);
assert.equal(persistence.snapshot().entries[0].status, 'scheduled');

let saveCalls = 0;
const cleanPersistence = createTaskSchedulePersistence({
  adapter: {
    async load() { return { schemaVersion: 1, snapshot: { entries: [scheduled] } }; },
    async save() { saveCalls += 1; }
  }
});
await cleanPersistence.open();
assert.equal(saveCalls, 0);
console.log('schedule restart persistence ok');
