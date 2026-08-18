import assert from 'node:assert/strict';
import { createScheduleStorageRuntime } from '../lib/schedule-storage-runtime.mjs';

let saved = null;
const adapter = {
  async load() { return saved; },
  async save(value) { saved = structuredClone(value); }
};

const runtime = await createScheduleStorageRuntime({
  env: {},
  ownerMaxEntries: 2,
  readConfig: () => ({ filePath: '/tmp/ignored', key: Buffer.alloc(32, 7) }),
  createEncryptedAdapter: () => adapter,
  storeOptions: { now: () => new Date('2026-08-18T08:00:00Z') }
});

assert.equal(runtime.durable, true);
const make = (ownerId, n) => ({
  ownerId,
  traceId: `trace-${ownerId}-${n}`,
  agentId: 'minimal-engineer',
  task: `task-${n}`,
  runAt: '2026-08-19T08:00:00Z'
});

await runtime.store.add(make('alice', 1));
await runtime.store.add(make('alice', 2));
await assert.rejects(runtime.store.add(make('alice', 3)), /TASK_SCHEDULE_FULL/);
await runtime.store.add(make('bob', 1));
assert.equal(runtime.store.snapshot().entries.length, 3);
assert.equal(saved.schemaVersion, 1);
assert.equal(saved.snapshot.entries.filter((entry) => entry.ownerId === 'alice').length, 2);

console.log('durable owner schedule quota: ok');
