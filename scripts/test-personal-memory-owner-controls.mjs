import assert from 'node:assert/strict';
import { createPersonalMemoryPersistence } from '../lib/personal-memory-persistence.mjs';

const key = Buffer.alloc(32, 4);
const initial = {
  schemaVersion: 1,
  entries: [
    { memoryId: 'memory_aaaaaaaa', ownerId: 'owner-a', kind: 'note', content: 'A', sourceType: 'user_note', sourceRef: 'a-1', sensitivity: 'personal', createdAt: '2026-08-13T15:00:00.000Z', updatedAt: null },
    { memoryId: 'memory_bbbbbbbb', ownerId: 'owner-b', kind: 'note', content: 'B', sourceType: 'user_note', sourceRef: 'b-1', sensitivity: 'personal', createdAt: '2026-08-13T15:00:00.000Z', updatedAt: null }
  ]
};

function createStore({ initialSnapshot = null } = {}) {
  const state = structuredClone(initialSnapshot ?? initial);
  return {
    snapshot: () => structuredClone(state),
    read: () => ({ ok: true, records: [] }),
    readForContext: () => ({ ok: true, records: [] }),
    write: () => ({ ok: false, error: 'unused' }),
    remove: () => ({ ok: false, error: 'unused' })
  };
}

let saved = null;
const adapter = {
  load: async () => null,
  save: async (value) => { saved = structuredClone(value); }
};
const memory = createPersonalMemoryPersistence({ adapter, key, createStore });
await memory.open();

const exported = memory.exportOwner({ ownerId: 'owner-a', explicitUserIntent: true });
assert.equal(exported.ok, true);
assert.equal(exported.records.length, 1);
assert.equal(exported.records[0].content, 'A');
assert.equal('ownerId' in exported.records[0], false);
assert.throws(
  () => memory.exportOwner({ ownerId: 'owner-a', explicitUserIntent: false }),
  /MEMORY_OWNER_CONTROL_REQUIRES_EXPLICIT_INTENT/
);

assert.deepEqual(
  await memory.deleteOwner({ ownerId: 'owner-a', confirmOwnerId: 'owner-b', explicitUserIntent: true }),
  { ok: false, error: 'MEMORY_DELETE_ALL_REQUIRES_OWNER_CONFIRMATION' }
);
assert.equal(memory.snapshot().entries.length, 2);

assert.deepEqual(
  await memory.deleteOwner({ ownerId: 'owner-a', confirmOwnerId: 'owner-a', explicitUserIntent: true }),
  { ok: true, deleted: 1 }
);
assert.equal(memory.snapshot().entries.length, 1);
assert.equal(memory.snapshot().entries[0].ownerId, 'owner-b');
assert.ok(saved);

const failing = createPersonalMemoryPersistence({
  adapter: { load: async () => null, save: async () => { throw new Error('disk'); } },
  key,
  createStore
});
await failing.open();
assert.deepEqual(
  await failing.deleteOwner({ ownerId: 'owner-a', confirmOwnerId: 'owner-a', explicitUserIntent: true }),
  { ok: false, error: 'MEMORY_PERSISTENCE_SAVE_FAILED' }
);
assert.equal(failing.snapshot().entries.length, 2);

console.log('personal memory owner control tests passed');
