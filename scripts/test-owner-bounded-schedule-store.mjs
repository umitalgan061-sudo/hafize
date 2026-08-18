import assert from 'node:assert/strict';
import { createOwnerBoundedScheduleStore } from '../lib/owner-bounded-schedule-store.mjs';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

const base = createTaskScheduleStore({ now: () => new Date('2026-08-18T08:00:00Z') });
const store = createOwnerBoundedScheduleStore({ store: base, maxEntriesPerOwner: 2 });

const input = (ownerId, n) => ({
  ownerId,
  traceId: `trace-${ownerId}-${n}`,
  agentId: 'minimal-engineer',
  task: `task ${n}`,
  runAt: `2026-08-18T09:0${n}:00Z`,
  maxAttempts: 1,
  retryDelayMs: 60000
});

const first = await store.add(input('alice', 1));
const second = await store.add(input('alice', 2));
assert.equal(first.ownerId, 'alice');
assert.equal(second.ownerId, 'alice');
assert.equal(store.ownerMaxEntries, 2);

await assert.rejects(
  store.add(input('alice', 3)),
  (error) => error?.message === 'TASK_SCHEDULE_FULL'
);

const bob = await store.add(input('bob', 1));
assert.equal(bob.ownerId, 'bob');
assert.equal(store.snapshot().entries.length, 3);

const anonymous = await store.add({ ...input(null, 4), ownerId: null });
assert.equal(anonymous.ownerId, null);
assert.equal(store.snapshot().entries.length, 4);

assert.equal(store.read(first.scheduleId).task, 'task 1');
assert.equal(store.claimDue({ limit: 1 }).length, 0);

console.log('owner-bounded schedule store: ok');
