import assert from 'node:assert/strict';
import { createPersonalMemoryRuntime } from '../lib/personal-memory-runtime.mjs';

const key = Buffer.alloc(32, 4);
const calls = [];
const persistence = {
  open: async () => ({}), snapshot: () => ({}), read: () => ({}), readForContext: () => ({}),
  exportOwner: (input) => { calls.push(['export', input]); return { ok: true, records: [] }; },
  write: async () => ({}), remove: async () => ({}),
  deleteOwner: async (input) => { calls.push(['delete', input]); return { ok: true, deleted: 0 }; }
};
const runtime = createPersonalMemoryRuntime({
  env: { HAFIZE_MEMORY_KEY_B64: key.toString('base64'), HAFIZE_MEMORY_STORAGE_DIR: '/tmp/hafize-memory-test' },
  createAdapter: () => ({}), createPersistence: () => persistence
});
const exportInput = { ownerId: 'owner-1', explicitUserIntent: true };
const deleteInput = { ownerId: 'owner-1', confirmOwnerId: 'owner-1', explicitUserIntent: true };
assert.deepEqual(runtime.exportOwner(exportInput), { ok: true, records: [] });
assert.deepEqual(await runtime.deleteOwner(deleteInput), { ok: true, deleted: 0 });
assert.deepEqual(calls, [['export', exportInput], ['delete', deleteInput]]);
console.log('personal memory runtime owner control tests passed');
