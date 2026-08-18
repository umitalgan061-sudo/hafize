import { createEncryptedFileScheduleAdapter } from './encrypted-file-schedule-adapter.mjs';
import { readEncryptedScheduleStorageConfig } from './encrypted-schedule-config.mjs';
import { createOwnerBoundedScheduleStore } from './owner-bounded-schedule-store.mjs';
import { createTaskSchedulePersistence } from './task-schedule-persistence.mjs';
import { createTaskScheduleStore } from './task-schedule-store.mjs';

function requireFactory(value, label) {
  if (typeof value !== 'function') throw new Error(`INVALID_SCHEDULE_STORAGE_RUNTIME:${label}`);
  return value;
}

export async function createScheduleStorageRuntime({
  env = process.env,
  storeOptions = {},
  ownerMaxEntries,
  readConfig = readEncryptedScheduleStorageConfig,
  createEncryptedAdapter = createEncryptedFileScheduleAdapter,
  createPersistence = createTaskSchedulePersistence,
  createMemoryStore = createTaskScheduleStore,
  createOwnerBoundedStore = createOwnerBoundedScheduleStore
} = {}) {
  requireFactory(readConfig, 'readConfig');
  requireFactory(createEncryptedAdapter, 'createEncryptedAdapter');
  requireFactory(createPersistence, 'createPersistence');
  requireFactory(createMemoryStore, 'createMemoryStore');
  requireFactory(createOwnerBoundedStore, 'createOwnerBoundedStore');
  if (!storeOptions || Array.isArray(storeOptions) || typeof storeOptions !== 'object') {
    throw new Error('INVALID_SCHEDULE_STORAGE_RUNTIME:storeOptions');
  }

  const wrap = (store) => createOwnerBoundedStore({
    store,
    ...(ownerMaxEntries === undefined ? {} : { maxEntriesPerOwner: ownerMaxEntries })
  });

  const config = readConfig({ env });
  if (!config) {
    return Object.freeze({
      store: wrap(createMemoryStore(storeOptions)),
      durable: false
    });
  }

  const key = config.key;
  try {
    const adapter = createEncryptedAdapter({ filePath: config.filePath, key });
    const store = createPersistence({ adapter, storeOptions });
    if (typeof store?.open !== 'function') throw new Error('INVALID_SCHEDULE_STORAGE_RUNTIME:persistence');
    await store.open();
    return Object.freeze({ store: wrap(store), durable: true });
  } catch {
    throw new Error('SCHEDULE_STORAGE_STARTUP_FAILED');
  } finally {
    if (Buffer.isBuffer(key)) key.fill(0);
  }
}
