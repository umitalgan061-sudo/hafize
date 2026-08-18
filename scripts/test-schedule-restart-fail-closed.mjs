import assert from 'node:assert/strict';
import { createTaskSchedulePersistence } from '../lib/task-schedule-persistence.mjs';

const running = {
  scheduleId: 'schedule_1', traceId: 'trace_1', ownerId: null, agentId: 'minimal-engineer', task: 'task',
  runAt: '2026-08-18T01:00:00.000Z', status: 'running', attempts: 1, maxAttempts: 1,
  retryDelayMs: 60_000, lastError: null, createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-18T01:00:00.000Z'
};
let saves = 0;
const persistence = createTaskSchedulePersistence({
  adapter: {
    async load() { return { schemaVersion: 1, snapshot: { entries: [running] } }; },
    async save() { saves += 1; throw new Error('disk detail must not escape'); }
  }
});
await assert.rejects(() => persistence.open(), /SCHEDULE_PERSISTENCE_RECOVERY_SAVE_FAILED/);
assert.equal(saves, 1);
assert.throws(() => persistence.snapshot(), /SCHEDULE_PERSISTENCE_NOT_OPEN/);

const badRecovery = createTaskSchedulePersistence({
  adapter: { async load() { return { schemaVersion: 1, snapshot: { entries: [] } }; }, async save() {} },
  recoverSnapshot() { throw new Error('internal detail'); }
});
await assert.rejects(() => badRecovery.open(), /SCHEDULE_PERSISTENCE_INVALID_SNAPSHOT/);
assert.throws(() => createTaskSchedulePersistence({
  adapter: { async load() {}, async save() {} }, recoverSnapshot: null
}), /INVALID_SCHEDULE_PERSISTENCE:recoverSnapshot/);
console.log('schedule restart fail-closed ok');
