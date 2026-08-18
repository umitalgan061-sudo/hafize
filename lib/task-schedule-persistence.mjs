import { recoverInterruptedScheduleSnapshot } from './schedule-restart-recovery.mjs';
import { createTaskScheduleStore } from './task-schedule-store.mjs';

const SCHEMA_VERSION = 1;
const MUTATIONS = new Set(['add', 'claimDue', 'complete', 'fail', 'defer', 'reschedule', 'cancel']);
const ENVELOPE_FIELDS = new Set(['schemaVersion', 'snapshot']);

function cloneSnapshot(snapshot) {
  return { entries: snapshot.entries.map((entry) => ({ ...entry })) };
}

function cloneEnvelope(snapshot) {
  return { schemaVersion: SCHEMA_VERSION, snapshot: cloneSnapshot(snapshot) };
}

function readEnvelope(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('SCHEDULE_PERSISTENCE_INVALID_SNAPSHOT');
  }
  for (const key of Object.keys(value)) {
    if (!ENVELOPE_FIELDS.has(key)) throw new Error('SCHEDULE_PERSISTENCE_INVALID_SNAPSHOT');
  }
  if (value.schemaVersion !== SCHEMA_VERSION) throw new Error('SCHEDULE_PERSISTENCE_INVALID_SNAPSHOT');
  return value.snapshot;
}

export function createTaskSchedulePersistence({
  adapter,
  storeOptions = {},
  createStore = createTaskScheduleStore,
  recoverSnapshot = recoverInterruptedScheduleSnapshot
} = {}) {
  if (typeof adapter?.load !== 'function' || typeof adapter?.save !== 'function') {
    throw new Error('INVALID_SCHEDULE_PERSISTENCE:adapter');
  }
  if (!storeOptions || Array.isArray(storeOptions) || typeof storeOptions !== 'object') {
    throw new Error('INVALID_SCHEDULE_PERSISTENCE:storeOptions');
  }
  if (typeof createStore !== 'function') throw new Error('INVALID_SCHEDULE_PERSISTENCE:createStore');
  if (typeof recoverSnapshot !== 'function') throw new Error('INVALID_SCHEDULE_PERSISTENCE:recoverSnapshot');

  let state = null;
  let openPromise = null;
  let queue = Promise.resolve();

  function requireOpen() {
    if (!state) throw new Error('SCHEDULE_PERSISTENCE_NOT_OPEN');
  }

  function instantiate(snapshot = state) {
    return createStore({ ...storeOptions, initialSnapshot: cloneSnapshot(snapshot) });
  }

  async function open() {
    if (state) return cloneSnapshot(state);
    if (openPromise) return openPromise;

    openPromise = (async () => {
      let loaded;
      try {
        loaded = await adapter.load();
      } catch {
        throw new Error('SCHEDULE_PERSISTENCE_LOAD_FAILED');
      }

      try {
        const initialSnapshot = loaded == null ? { entries: [] } : readEnvelope(loaded);
        const recovery = recoverSnapshot(initialSnapshot);
        const store = createStore({ ...storeOptions, initialSnapshot: recovery.snapshot });
        const recoveredSnapshot = store.snapshot();
        if (recovery.recovered > 0) {
          try {
            await adapter.save(cloneEnvelope(recoveredSnapshot));
          } catch {
            throw new Error('SCHEDULE_PERSISTENCE_RECOVERY_SAVE_FAILED');
          }
        }
        state = recoveredSnapshot;
      } catch (error) {
        if (error?.message === 'SCHEDULE_PERSISTENCE_INVALID_SNAPSHOT') throw error;
        if (error?.message === 'SCHEDULE_PERSISTENCE_RECOVERY_SAVE_FAILED') throw error;
        throw new Error('SCHEDULE_PERSISTENCE_INVALID_SNAPSHOT');
      }
      return cloneSnapshot(state);
    })();

    try {
      return await openPromise;
    } finally {
      openPromise = null;
    }
  }

  function snapshot() {
    requireOpen();
    return cloneSnapshot(state);
  }

  function read(scheduleId = null) {
    requireOpen();
    return instantiate().read(scheduleId);
  }

  function mutate(method, ...args) {
    if (!MUTATIONS.has(method)) return Promise.reject(new Error('INVALID_SCHEDULE_PERSISTENCE:mutation'));
    const operation = queue.then(async () => {
      requireOpen();
      const candidate = instantiate();
      const result = candidate[method](...args);
      const next = candidate.snapshot();
      try {
        await adapter.save(cloneEnvelope(next));
      } catch {
        throw new Error('SCHEDULE_PERSISTENCE_SAVE_FAILED');
      }
      state = next;
      return result;
    });
    queue = operation.catch(() => undefined);
    return operation;
  }

  return Object.freeze({
    open,
    snapshot,
    read,
    add: (...args) => mutate('add', ...args),
    claimDue: (...args) => mutate('claimDue', ...args),
    complete: (...args) => mutate('complete', ...args),
    fail: (...args) => mutate('fail', ...args),
    defer: (...args) => mutate('defer', ...args),
    reschedule: (...args) => mutate('reschedule', ...args),
    cancel: (...args) => mutate('cancel', ...args)
  });
}
