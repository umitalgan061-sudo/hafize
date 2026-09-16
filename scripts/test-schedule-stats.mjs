import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

const now = () => new Date('2026-09-16T06:00:00.000Z');
const snapshot = {
  entries: [
    ['schedule_1', 'alice', 'scheduled', 0],
    ['schedule_2', 'alice', 'running', 1],
    ['schedule_3', 'alice', 'completed', 1],
    ['schedule_4', 'alice', 'failed', 1],
    ['schedule_5', 'bob', 'cancelled', 0],
    ['schedule_6', 'bob', 'scheduled', 0]
  ].map(([scheduleId, ownerId, status, attempts], index) => ({
    scheduleId,
    traceId: `trace-${index}`,
    ownerId,
    agentId: 'hafize-general',
    task: `task-${index}`,
    runAt: status === 'scheduled' ? '2026-09-15T06:00:00.000Z' : '2026-09-17T06:00:00.000Z',
    status,
    attempts,
    maxAttempts: 2,
    lastError: status === 'failed' ? 'TEST_FAILED' : null,
    createdAt: `2026-09-16T06:0${index}:00.000Z`,
    updatedAt: status === 'scheduled' ? null : '2026-09-16T06:10:00.000Z'
  }))
};
const store = createTaskScheduleStore({ now, initialSnapshot: snapshot });

const all = store.stats();
assert.equal(all.total, 6);
assert.deepEqual(all.counts, { scheduled: 2, running: 1, completed: 1, failed: 1, cancelled: 1 });
assert.equal(all.due, 2);
assert.equal(all.retrying, 0);
assert.equal(all.capacity, 'unbounded');

const alice = store.stats('alice');
assert.equal(alice.total, 4);
assert.deepEqual(alice.counts, { scheduled: 1, running: 1, completed: 1, failed: 1, cancelled: 0 });
assert.equal(alice.due, 1);

const bob = store.stats('bob');
assert.equal(bob.total, 2);
assert.deepEqual(bob.counts, { scheduled: 1, running: 0, completed: 0, failed: 0, cancelled: 1 });
assert.equal(bob.due, 1);

console.log('schedule stats tests passed');
