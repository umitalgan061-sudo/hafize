import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { createPersonalMemoryRuntime, PERSONAL_MEMORY_FILE_NAME } from '../lib/personal-memory-runtime.mjs';

const key = Buffer.alloc(32, 9);
const env = {
  HAFIZE_MEMORY_KEY_B64: key.toString('base64'),
  HAFIZE_MEMORY_STORAGE_DIR: '/srv/hafize/data',
  HAFIZE_MEMORY_MAX_FILE_BYTES: '8192'
};
let adapterOptions;
let persistenceOptions;
const calls = [];
const persistence = {
  open: async () => { calls.push('open'); return { schemaVersion: 1, entries: [] }; },
  snapshot: () => { calls.push('snapshot'); return { schemaVersion: 1, entries: [] }; },
  read: (value) => { calls.push(['read', value]); return { ok: true, records: [] }; },
  readForContext: (value) => { calls.push(['context', value]); return { ok: true, records: [] }; },
  write: async (value) => { calls.push(['write', value]); return { ok: true }; },
  remove: async (value) => { calls.push(['remove', value]); return { ok: true }; }
};
const runtime = createPersonalMemoryRuntime({
  env,
  storeOptions: { maxEntries: 12 },
  createAdapter: (options) => { adapterOptions = options; return { load() {}, save() {} }; },
  createPersistence: (options) => { persistenceOptions = options; return persistence; }
});

assert.equal(PERSONAL_MEMORY_FILE_NAME, 'personal-memory.enc.json');
assert.equal(adapterOptions.filePath, resolve('/srv/hafize/data', PERSONAL_MEMORY_FILE_NAME));
assert.equal(adapterOptions.maxFileBytes, 8192);
assert.deepEqual(persistenceOptions.storeOptions, { maxEntries: 12 });
assert.deepEqual(persistenceOptions.key, key);
assert.equal('key' in runtime, false);
assert.equal('adapter' in runtime, false);
assert.equal('filePath' in runtime, false);
assert.equal(Object.isFrozen(runtime), true);

await runtime.open();
runtime.snapshot();
runtime.read({ ownerId: 'u', query: 'x' });
runtime.readForContext({ ownerId: 'u', query: 'x' });
await runtime.write({ ownerId: 'u' });
await runtime.remove({ ownerId: 'u' });
assert.equal(calls.length, 6);

for (const badEnv of [
  {},
  { ...env, HAFIZE_MEMORY_KEY_B64: '' },
  { ...env, HAFIZE_MEMORY_KEY_B64: Buffer.alloc(31).toString('base64') },
  { ...env, HAFIZE_MEMORY_KEY_B64: 'not-base64' },
  { ...env, HAFIZE_MEMORY_STORAGE_DIR: '' },
  { ...env, HAFIZE_MEMORY_MAX_FILE_BYTES: '100' },
  { ...env, HAFIZE_MEMORY_MAX_FILE_BYTES: '1.5' }
]) {
  assert.throws(
    () => createPersonalMemoryRuntime({
      env: badEnv,
      createAdapter: () => ({}),
      createPersistence: () => persistence
    }),
    /INVALID_MEMORY_RUNTIME/
  );
}

let noLimit;
createPersonalMemoryRuntime({
  env: {
    HAFIZE_MEMORY_KEY_B64: key.toString('base64'),
    HAFIZE_MEMORY_STORAGE_DIR: './data'
  },
  createAdapter: (options) => { noLimit = options; return {}; },
  createPersistence: () => persistence
});
assert.deepEqual(Object.keys(noLimit), ['filePath']);
assert.equal(noLimit.filePath, join(resolve('./data'), PERSONAL_MEMORY_FILE_NAME));

assert.throws(
  () => createPersonalMemoryRuntime({ env, createAdapter: null }),
  /INVALID_MEMORY_RUNTIME:createAdapter/
);
assert.throws(
  () => createPersonalMemoryRuntime({ env, createAdapter: () => ({}), createPersistence: null }),
  /INVALID_MEMORY_RUNTIME:createPersistence/
);

console.log('personal memory runtime tests passed');
