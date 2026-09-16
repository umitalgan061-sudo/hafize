import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

const now = () => new Date('2026-09-16T06:00:00.000Z');
const store = createTaskScheduleStore({ now });
const states = ['scheduled', 'scheduled', 'running', 'completed', 'failed', 'cancelled'];
for (let index = 0; index < states.length; index += 1) {
  const entry = store.add({ traceId: `trace-${index}`, agentId: 'hafize-general', task: `task-${index}`, runAt: '2026-09-15T06:00:00.000Z', ownerId: index < 4 ? 'alice' : 'bob' });
  if (states[index] === 'running') store.claimDue();
  if (states[index] === 'completed') { const claimed = store.claimDue(); store.complete(claimed.at(-1).scheduleId); }
  if (states[index] === 'failed') { const claimed = store.claimDue(); store.fail(claimed.at(-1).scheduleId); }
  if (states[index] === 'cancelled') store.cancel(entry.scheduleId);
}
const all = store.stats();
assert.equal(all.total, 6);
assert.equal(all.counts.scheduled >= 1, true);
assert.equal(all.counts.cancelled, 1);
assert.equal(typeof all.due, 'number');
assert.equal(all.capacity, 'unbounded');
const alice = store.stats('alice');
assert.equal(alice.total, 4);
assert.equal(alice.counts.scheduled >= 1, true);
assert.equal(store.list({ ownerId: 'alice', limit: 2 }).entries.length, 2);

console.log('schedule stats tests passed');
