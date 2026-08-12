import assert from 'node:assert/strict';
import { createScheduleStorageRuntime } from '../lib/schedule-storage-runtime.mjs';

const memoryStore = Object.freeze({ kind: 'memory' });
let memoryCalls = 0;
const memory = await createScheduleStorageRuntime({
  env: {},
  readConfig: () => null,
  createMemoryStore(options) {
    memoryCalls += 1;
    assert.deepEqual(options, { maxEntries: 7 });
    return memoryStore;
  },
  createEncryptedAdapter() {
    throw new Error('must not create encrypted adapter');
  },
  createPersistence() {
    throw new Error('must not create persistence');
  },
  storeOptions: { maxEntries: 7 }
});
assert.equal(memory.durable, false);
assert.equal(memory.store, memoryStore);
assert.equal(memoryCalls, 1);
assert.equal(Object.isFrozen(memory), true);

const events = [];
const sourceKey = Buffer.alloc(32, 9);
const persistedStore = {
  opened: false,
  async open() {
    events.push('open:start');
    await Promise.resolve();
    this.opened = true;
    events.push('open:end');
  }
};
const durable = await createScheduleStorageRuntime({
  env: { marker: 'env' },
  readConfig({ env }) {
    events.push('config');
    assert.equal(env.marker, 'env');
    return { filePath: '/tmp/hafize-schedules.enc', get key() { return Buffer.from(sourceKey); } };
  },
  createEncryptedAdapter({ filePath, key }) {
    events.push('adapter');
    assert.equal(filePath, '/tmp/hafize-schedules.enc');
    assert.equal(key.equals(sourceKey), true);
    return { keyWasCopied: Buffer.from(key) };
  },
  createPersistence({ adapter, storeOptions }) {
    events.push('persistence');
    assert.equal(adapter.keyWasCopied.equals(sourceKey), true);
    assert.deepEqual(storeOptions, { maxEntries: 12 });
    return persistedStore;
  },
  createMemoryStore() {
    throw new Error('must not create memory store');
  },
  storeOptions: { maxEntries: 12 }
});
assert.deepEqual(events, ['config', 'adapter', 'persistence', 'open:start', 'open:end']);
assert.equal(durable.durable, true);
assert.equal(durable.store, persistedStore);
assert.equal(durable.store.opened, true);
assert.equal(Object.isFrozen(durable), true);

let executionReached = false;
await assert.rejects(
  createScheduleStorageRuntime({
    readConfig: () => ({ filePath: '/tmp/bad.enc', key: Buffer.alloc(32, 1) }),
    createEncryptedAdapter: () => ({}),
    createPersistence: () => ({
      async open() {
        throw new Error('provider secret detail');
      }
    }),
    createMemoryStore() {
      executionReached = true;
      return {};
    }
  }),
  /provider secret detail/
);
assert.equal(executionReached, false);

assert.throws(
  () => createScheduleStorageRuntime({ storeOptions: [] }),
  /INVALID_SCHEDULE_STORAGE_RUNTIME:storeOptions/
);

console.log('schedule storage runtime tests passed');
