import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

const now = () => new Date('2026-09-16T06:00:00.000Z');

const unlimited = createTaskScheduleStore({ now });
for (let index = 0; index < 2048; index += 1) {
  unlimited.add({ traceId: `trace-${index}`, agentId: 'hafize-general', task: `task-${index}`, runAt: '2026-09-17T06:00:00Z' });
}
assert.equal(unlimited.snapshot().entries.length, 2048);
assert.equal(unlimited.capacity, Number.POSITIVE_INFINITY);
assert.equal(unlimited.stats().capacity, 'unbounded');

const bounded = createTaskScheduleStore({ maxEntries: 3, now });
for (let index = 0; index < 3; index += 1) bounded.add({ traceId: `bounded-${index}`, agentId: 'hafize-general', task: `bounded-${index}`, runAt: '2026-09-17T06:00:00Z' });
assert.throws(() => bounded.add({ traceId: 'bounded-4', agentId: 'hafize-general', task: 'bounded-4', runAt: '2026-09-17T06:00:00Z' }), /TASK_SCHEDULE_FULL/);
assert.equal(bounded.stats().capacity, 'bounded');

assert.throws(() => createTaskScheduleStore({ maxEntries: 0, now }), /INVALID_TASK_SCHEDULE:maxEntries/);
assert.throws(() => createTaskScheduleStore({ maxEntries: -1, now }), /INVALID_TASK_SCHEDULE:maxEntries/);
assert.throws(() => createTaskScheduleStore({ maxEntries: 1.5, now }), /INVALID_TASK_SCHEDULE:maxEntries/);

console.log('schedule capacity contract tests passed');
