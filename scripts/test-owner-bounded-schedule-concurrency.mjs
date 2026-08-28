import assert from 'node:assert/strict';
import { createOwnerBoundedScheduleStore } from '../lib/owner-bounded-schedule-store.mjs';

const entries = [];
let addCalls = 0;
const target = {
  async add(input) {
    addCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    const entry = { ...input, scheduleId: `schedule_${entries.length + 1}`, status: 'scheduled' };
    entries.push(entry);
    return { ...entry };
  },
  snapshot() { return { entries: entries.map((entry) => ({ ...entry })) }; },
  claimDue() { return []; },
  complete() {},
  fail() {},
  defer() {},
  reschedule() {},
  cancel() {},
  read() { return null; }
};

const store = createOwnerBoundedScheduleStore({ store: target, maxEntriesPerOwner: 1 });
const make = (ownerId, suffix) => ({ ownerId, traceId: `t-${suffix}`, agentId: 'minimal-engineer', task: suffix, runAt: '2026-08-19T10:00:00Z' });

const results = await Promise.allSettled([
  store.add(make('alice', 'a')),
  store.add(make('alice', 'b')),
  store.add(make('alice', 'c'))
]);
assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
assert.equal(results.filter((result) => result.status === 'rejected').length, 2);
assert.equal(addCalls, 1);
assert.equal(entries.filter((entry) => entry.ownerId === 'alice').length, 1);

const parallelOwners = await Promise.all([
  store.add(make('bob', 'b')),
  store.add(make('carol', 'c'))
]);
assert.equal(parallelOwners.length, 2);
assert.equal(entries.length, 3);

console.log('owner schedule concurrent quota: ok');
