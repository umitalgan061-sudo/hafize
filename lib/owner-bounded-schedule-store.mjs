const DEFAULT_OWNER_MAX_ENTRIES = 100;
const MAX_OWNER_MAX_ENTRIES = 1000;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function normalizeOwnerMaxEntries(value = DEFAULT_OWNER_MAX_ENTRIES) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_OWNER_MAX_ENTRIES) {
    fail('INVALID_OWNER_SCHEDULE_LIMIT');
  }
  return value;
}

function normalizeOwnerId(value) {
  if (value == null) return null;
  const ownerId = typeof value === 'string' ? value.trim() : '';
  if (!ownerId || ownerId.length > 200) fail('INVALID_TASK_SCHEDULE:ownerId');
  return ownerId;
}

function requireStore(store) {
  const methods = ['add', 'claimDue', 'complete', 'fail', 'defer', 'reschedule', 'cancel', 'read', 'snapshot'];
  for (const method of methods) {
    if (typeof store?.[method] !== 'function') fail(`INVALID_OWNER_SCHEDULE_STORE:${method}`);
  }
  return store;
}

function countOwnedEntries(snapshot, ownerId) {
  if (!snapshot || !Array.isArray(snapshot.entries)) fail('INVALID_OWNER_SCHEDULE_SNAPSHOT');
  let count = 0;
  for (const entry of snapshot.entries) {
    if (entry?.ownerId === ownerId) count += 1;
  }
  return count;
}

export function createOwnerBoundedScheduleStore({ store, maxEntriesPerOwner = DEFAULT_OWNER_MAX_ENTRIES } = {}) {
  const target = requireStore(store);
  const ownerLimit = normalizeOwnerMaxEntries(maxEntriesPerOwner);
  const ownerQueues = new Map();

  function withOwnerQueue(ownerId, operation) {
    const previous = ownerQueues.get(ownerId) || Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    ownerQueues.set(ownerId, current);
    void current.finally(() => {
      if (ownerQueues.get(ownerId) === current) ownerQueues.delete(ownerId);
    }).catch(() => undefined);
    return current;
  }

  function add(input = {}) {
    const ownerId = normalizeOwnerId(input?.ownerId);
    if (ownerId == null) return target.add(input);

    return withOwnerQueue(ownerId, async () => {
      const snapshot = await target.snapshot();
      if (countOwnedEntries(snapshot, ownerId) >= ownerLimit) {
        fail('TASK_SCHEDULE_OWNER_FULL');
      }
      return target.add(input);
    });
  }

  return Object.freeze({
    add,
    claimDue: (...args) => target.claimDue(...args),
    complete: (...args) => target.complete(...args),
    fail: (...args) => target.fail(...args),
    defer: (...args) => target.defer(...args),
    reschedule: (...args) => target.reschedule(...args),
    cancel: (...args) => target.cancel(...args),
    read: (...args) => target.read(...args),
    snapshot: (...args) => target.snapshot(...args),
    ownerMaxEntries: ownerLimit
  });
}

export {
  DEFAULT_OWNER_MAX_ENTRIES,
  MAX_OWNER_MAX_ENTRIES,
  countOwnedEntries,
  normalizeOwnerId,
  normalizeOwnerMaxEntries
};
