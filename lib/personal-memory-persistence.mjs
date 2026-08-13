import { createPersonalMemoryStore } from './personal-memory-store.mjs';
import {
  decryptPersonalMemorySnapshot,
  encryptPersonalMemorySnapshot
} from './personal-memory-encryption.mjs';

const EXPORT_FIELDS = new Set(['ownerId', 'explicitUserIntent']);
const DELETE_OWNER_FIELDS = new Set(['ownerId', 'confirmOwnerId', 'explicitUserIntent']);

function cloneSnapshot(snapshot) {
  return {
    schemaVersion: snapshot.schemaVersion,
    entries: snapshot.entries.map((entry) => ({ ...entry }))
  };
}

function normalizeOwnerControl(input, allowed, needsConfirmation = false) {
  if (!input || Array.isArray(input) || typeof input !== 'object') {
    throw new Error('INVALID_MEMORY_OWNER_CONTROL:input');
  }
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new Error('INVALID_MEMORY_OWNER_CONTROL:field');
  }
  const ownerId = typeof input.ownerId === 'string' ? input.ownerId.trim() : '';
  if (!ownerId || ownerId.length > 200) throw new Error('INVALID_MEMORY_OWNER_CONTROL:ownerId');
  if (input.explicitUserIntent !== true) throw new Error('MEMORY_OWNER_CONTROL_REQUIRES_EXPLICIT_INTENT');
  if (needsConfirmation && input.confirmOwnerId !== ownerId) {
    throw new Error('MEMORY_DELETE_ALL_REQUIRES_OWNER_CONFIRMATION');
  }
  return ownerId;
}

function exportRecord(entry) {
  const { ownerId: _ownerId, ...record } = entry;
  return { ...record };
}

export function createPersonalMemoryPersistence({
  adapter,
  key,
  storeOptions = {},
  createStore = createPersonalMemoryStore
} = {}) {
  if (typeof adapter?.load !== 'function' || typeof adapter?.save !== 'function') {
    throw new Error('INVALID_MEMORY_PERSISTENCE:adapter');
  }
  if (!Buffer.isBuffer(key) && !(key instanceof Uint8Array)) {
    throw new Error('INVALID_MEMORY_PERSISTENCE:key');
  }
  const encryptionKey = Buffer.from(key);
  if (encryptionKey.length !== 32) throw new Error('INVALID_MEMORY_PERSISTENCE:key');
  if (!storeOptions || Array.isArray(storeOptions) || typeof storeOptions !== 'object') {
    throw new Error('INVALID_MEMORY_PERSISTENCE:storeOptions');
  }
  if (typeof createStore !== 'function') throw new Error('INVALID_MEMORY_PERSISTENCE:createStore');

  let store = null;
  let openPromise = null;
  let queue = Promise.resolve();

  function requireOpen() {
    if (!store) throw new Error('MEMORY_PERSISTENCE_NOT_OPEN');
  }

  async function open() {
    if (store) return cloneSnapshot(store.snapshot());
    if (openPromise) return openPromise;
    openPromise = (async () => {
      let envelope;
      try {
        envelope = await adapter.load();
      } catch {
        throw new Error('MEMORY_PERSISTENCE_LOAD_FAILED');
      }
      try {
        const snapshot = envelope == null
          ? null
          : decryptPersonalMemorySnapshot(envelope, encryptionKey);
        store = createStore({ ...storeOptions, initialSnapshot: snapshot });
        return cloneSnapshot(store.snapshot());
      } catch {
        throw new Error('MEMORY_PERSISTENCE_LOAD_FAILED');
      }
    })();
    try {
      return await openPromise;
    } finally {
      openPromise = null;
    }
  }

  function snapshot() {
    requireOpen();
    return cloneSnapshot(store.snapshot());
  }

  function read(input) {
    requireOpen();
    return store.read(input);
  }

  function readForContext(input) {
    requireOpen();
    return store.readForContext(input);
  }

  function exportOwner(input) {
    requireOpen();
    const ownerId = normalizeOwnerControl(input, EXPORT_FIELDS);
    const records = store.snapshot().entries
      .filter((entry) => entry.ownerId === ownerId)
      .map(exportRecord);
    return { ok: true, records };
  }

  function mutate(method, input) {
    const operation = queue.then(async () => {
      requireOpen();
      const candidate = createStore({ ...storeOptions, initialSnapshot: store.snapshot() });
      const result = candidate[method](input);
      if (!result.ok) return result;
      const envelope = encryptPersonalMemorySnapshot(candidate.snapshot(), encryptionKey);
      try {
        await adapter.save(envelope);
      } catch {
        return { ok: false, error: 'MEMORY_PERSISTENCE_SAVE_FAILED' };
      }
      store = candidate;
      return result;
    });
    queue = operation.catch(() => undefined);
    return operation;
  }

  function deleteOwner(input) {
    let ownerId;
    try {
      ownerId = normalizeOwnerControl(input, DELETE_OWNER_FIELDS, true);
    } catch (error) {
      return Promise.resolve({ ok: false, error: error.message });
    }
    const operation = queue.then(async () => {
      requireOpen();
      const current = store.snapshot();
      const entries = current.entries.filter((entry) => entry.ownerId !== ownerId);
      const deleted = current.entries.length - entries.length;
      if (!deleted) return { ok: true, deleted: 0 };
      const candidate = createStore({
        ...storeOptions,
        initialSnapshot: { schemaVersion: current.schemaVersion, entries }
      });
      const envelope = encryptPersonalMemorySnapshot(candidate.snapshot(), encryptionKey);
      try {
        await adapter.save(envelope);
      } catch {
        return { ok: false, error: 'MEMORY_PERSISTENCE_SAVE_FAILED' };
      }
      store = candidate;
      return { ok: true, deleted };
    });
    queue = operation.catch(() => undefined);
    return operation;
  }

  return Object.freeze({
    open,
    snapshot,
    read,
    readForContext,
    exportOwner,
    write: (input) => mutate('write', input),
    remove: (input) => mutate('remove', input),
    deleteOwner
  });
}
