import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

const now = () => new Date('2026-09-16T06:00:00.000Z');
const store = createTaskScheduleStore({ now });

for (let index = 0; index < 1500; index += 1) {
  const entry = store.add({
    traceId: `trace-${index}`,
    agentId: 'hafize-general',
    task: `bulk scheduled task ${index}`,
    runAt: `2026-09-${String(16 + Math.floor(index / 100)).padStart(2, '0')}T06:${String(index % 60).padStart(2, '0')}:00.000Z`,
    ownerId: index % 2 ? 'user-b' : 'user-a'
  });
  assert.match(entry.scheduleId, /^schedule_[1-9][0-9]*$/);
}

assert.equal(store.snapshot().entries.length, 1500);
assert.equal(store.capacity, Number.POSITIVE_INFINITY);

const first = store.list({ ownerId: 'user-a', limit: 40, sort: 'created-desc' });
assert.equal(first.entries.length, 40);
assert.equal(first.total, 750);
assert.equal(first.hasMore, true);
assert.ok(first.nextCursor);

const seen = new Set(first.entries.map((entry) => entry.scheduleId));
let cursor = first.nextCursor;
let pages = 1;
while (cursor) {
  const page = store.list({ ownerId: 'user-a', limit: 40, sort: 'created-desc', cursor });
  pages += 1;
  page.entries.forEach((entry) => {
    assert.equal(seen.has(entry.scheduleId), false);
    seen.add(entry.scheduleId);
  });
  cursor = page.nextCursor;
}
assert.equal(seen.size, 750);
assert.ok(pages > 10);

const searched = store.list({ ownerId: 'user-b', q: 'bulk scheduled task 1499', limit: 10 });
assert.equal(searched.total, 1);
assert.equal(searched.entries[0].scheduleId, 'schedule_1500');

const dueStore = createTaskScheduleStore({ now });
for (let index = 0; index < 70; index += 1) {
  dueStore.add({ traceId: `due-${index}`, agentId: 'hafize-general', task: `due ${index}`, runAt: '2026-09-16T05:00:00.000Z' });
}
const claimed = dueStore.claimDue({ limit: 64 });
assert.equal(claimed.length, 64);
assert.equal(dueStore.snapshot().entries.filter((entry) => entry.status === 'running').length, 64);
assert.equal(dueStore.claimDue({ limit: 64 }).length, 6);
assert.equal(dueStore.snapshot().entries.filter((entry) => entry.status === 'running').length, 70);

const bigintSnapshot = {
  entries: [{
    scheduleId: 'schedule_9007199254740991', traceId: 'bigint', ownerId: 'user-a', agentId: 'hafize-general', task: 'large id',
    runAt: '2026-09-17T06:00:00.000Z', status: 'scheduled', attempts: 0, maxAttempts: 1, lastError: null,
    createdAt: '2026-09-16T06:00:00.000Z', updatedAt: null
  }]
};
const bigintStore = createTaskScheduleStore({ now, initialSnapshot: bigintSnapshot });
const next = bigintStore.add({ traceId: 'after-bigint', agentId: 'hafize-general', task: 'after safe integer', runAt: '2026-09-18T06:00:00.000Z' });
assert.equal(next.scheduleId, 'schedule_9007199254740992');

const finite = createTaskScheduleStore({ maxEntries: 2, now });
finite.add({ traceId: 'one', agentId: 'hafize-general', task: 'one', runAt: '2026-09-17T06:00:00Z' });
finite.add({ traceId: 'two', agentId: 'hafize-general', task: 'two', runAt: '2026-09-17T07:00:00Z' });
assert.throws(() => finite.add({ traceId: 'three', agentId: 'hafize-general', task: 'three', runAt: '2026-09-17T08:00:00Z' }), /TASK_SCHEDULE_FULL/);

console.log('task schedule unbounded tests passed');
