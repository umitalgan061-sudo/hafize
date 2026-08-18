import assert from 'node:assert/strict';
import { createScheduleStorageRuntime } from '../lib/schedule-storage-runtime.mjs';

const runtime = await createScheduleStorageRuntime({
  env: {},
  ownerMaxEntries: 1,
  readConfig: () => null,
  storeOptions: { now: () => new Date('2026-08-18T08:00:00Z') }
});

assert.equal(runtime.durable, false);
assert.equal(runtime.store.ownerMaxEntries, 1);

const make = (ownerId, suffix) => ({
  ownerId,
  traceId: `trace-${suffix}`,
  agentId: 'minimal-engineer',
  task: `task-${suffix}`,
  runAt: '2026-08-19T08:00:00Z'
});

await runtime.store.add(make('alice', 'a'));
await assert.rejects(runtime.store.add(make('alice', 'b')), /TASK_SCHEDULE_FULL/);
await runtime.store.add(make('bob', 'b'));
assert.equal(runtime.store.snapshot().entries.length, 2);

await assert.rejects(
  createScheduleStorageRuntime({ env: {}, ownerMaxEntries: 0, readConfig: () => null }),
  /INVALID_OWNER_SCHEDULE_LIMIT/
);
await assert.rejects(
  createScheduleStorageRuntime({ env: {}, ownerMaxEntries: 1001, readConfig: () => null }),
  /INVALID_OWNER_SCHEDULE_LIMIT/
);

console.log('schedule storage owner capacity: ok');
