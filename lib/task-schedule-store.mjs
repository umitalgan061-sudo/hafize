const DEFAULT_MAX_ATTEMPTS = 1;
const MAX_ATTEMPTS = 5;
const ADD_FIELDS = new Set(['traceId', 'agentId', 'task', 'runAt', 'maxAttempts', 'ownerId']);
const SNAPSHOT_FIELDS = new Set(['entries']);
const ENTRY_FIELDS = new Set([
  'scheduleId', 'traceId', 'ownerId', 'agentId', 'task', 'runAt', 'status', 'attempts',
  'maxAttempts', 'lastError', 'createdAt', 'updatedAt'
]);
const STATUSES = new Set(['scheduled', 'running', 'completed', 'failed', 'cancelled']);

function cleanText(value, label, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength) throw new Error(`INVALID_TASK_SCHEDULE:${label}`);
  return text;
}

function cleanErrorCode(value) {
  const code = cleanText(value, 'error', 120);
  if (!/^[A-Z0-9_:-]+$/.test(code)) throw new Error('INVALID_TASK_SCHEDULE:error');
  return code;
}

function toIso(value, label) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`INVALID_TASK_SCHEDULE:${label}`);
  return date.toISOString();
}

function clone(entry) {
  return { ...entry };
}

function restoreSnapshot(initialSnapshot, capacity) {
  if (initialSnapshot == null) return [];
  if (!initialSnapshot || Array.isArray(initialSnapshot) || typeof initialSnapshot !== 'object') {
    throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:input');
  }
  for (const key of Object.keys(initialSnapshot)) {
    if (!SNAPSHOT_FIELDS.has(key)) throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:field');
  }
  if (!Array.isArray(initialSnapshot.entries)) throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:entries');
  if (capacity != null && initialSnapshot.entries.length > capacity) {
    throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:capacity');
  }

  const ids = new Set();
  return initialSnapshot.entries.map((raw) => {
    if (!raw || Array.isArray(raw) || typeof raw !== 'object') {
      throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:entry');
    }
    for (const key of Object.keys(raw)) {
      if (!ENTRY_FIELDS.has(key)) throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:entry_field');
    }

    const scheduleId = cleanText(raw.scheduleId, 'scheduleId', 120);
    const idMatch = /^schedule_([1-9][0-9]*)$/.exec(scheduleId);
    const numericId = idMatch ? Number(idMatch[1]) : Number.NaN;
    if (!idMatch || !Number.isSafeInteger(numericId) || ids.has(scheduleId)) {
      throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:scheduleId');
    }
    ids.add(scheduleId);

    const maxAttempts = raw.maxAttempts;
    const attempts = raw.attempts;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAX_ATTEMPTS) {
      throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:maxAttempts');
    }
    if (!Number.isInteger(attempts) || attempts < 0 || attempts > maxAttempts) {
      throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:attempts');
    }
    if (!STATUSES.has(raw.status)) throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:status');
    if (raw.status === 'scheduled' && attempts >= maxAttempts) {
      throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:attempts');
    }
    if ((raw.status === 'running' || raw.status === 'completed' || raw.status === 'failed') && attempts < 1) {
      throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:attempts');
    }

    const lastError = raw.lastError == null ? null : cleanErrorCode(raw.lastError);
    return {
      scheduleId,
      traceId: cleanText(raw.traceId, 'traceId', 128),
      ownerId: raw.ownerId == null ? null : cleanText(raw.ownerId, 'ownerId', 200),
      agentId: cleanText(raw.agentId, 'agentId', 120),
      task: cleanText(raw.task, 'task', 20000),
      runAt: toIso(raw.runAt, 'runAt'),
      status: raw.status,
      attempts,
      maxAttempts,
      lastError,
      createdAt: toIso(raw.createdAt, 'createdAt'),
      updatedAt: raw.updatedAt == null ? null : toIso(raw.updatedAt, 'updatedAt')
    };
  });
}

function nextScheduleNumber(entries) {
  let max = 0;
  for (const entry of entries) {
    const numeric = Number.parseInt(entry.scheduleId.slice('schedule_'.length), 10);
    if (numeric > max) max = numeric;
  }
  return max + 1;
}

export function createTaskScheduleStore({
  maxEntries = null,
  now = () => new Date(),
  initialSnapshot = null
} = {}) {
  const capacity = Number.isInteger(maxEntries) ? Math.max(maxEntries, 1) : null;
  const entries = restoreSnapshot(initialSnapshot, capacity);
  let nextId = nextScheduleNumber(entries);

  function currentDate() {
    const value = now();
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error('INVALID_TASK_SCHEDULE:now');
    return date;
  }

  function find(scheduleId) {
    const id = cleanText(scheduleId, 'scheduleId', 120);
    const entry = entries.find((item) => item.scheduleId === id);
    if (!entry) throw new Error('TASK_SCHEDULE_NOT_FOUND');
    return entry;
  }

  function snapshot() {
    return { entries: entries.map(clone) };
  }

  function add(input = {}) {
    if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('INVALID_TASK_SCHEDULE:input');
    for (const key of Object.keys(input)) {
      if (!ADD_FIELDS.has(key)) throw new Error('INVALID_TASK_SCHEDULE:field');
    }
    const { traceId, agentId, task, runAt, maxAttempts = DEFAULT_MAX_ATTEMPTS, ownerId = null } = input;
    if (capacity != null && entries.length >= capacity) throw new Error('TASK_SCHEDULE_FULL');
    const attempts = Number.isInteger(maxAttempts)
      ? Math.min(Math.max(maxAttempts, 1), MAX_ATTEMPTS)
      : DEFAULT_MAX_ATTEMPTS;
    const createdAt = currentDate().toISOString();
    const entry = {
      scheduleId: `schedule_${nextId++}`,
      traceId: cleanText(traceId, 'traceId', 128),
      ownerId: ownerId == null ? null : cleanText(ownerId, 'ownerId', 200),
      agentId: cleanText(agentId, 'agentId', 120),
      task: cleanText(task, 'task', 20000),
      runAt: toIso(runAt, 'runAt'),
      status: 'scheduled',
      attempts: 0,
      maxAttempts: attempts,
      lastError: null,
      createdAt,
      updatedAt: null
    };
    entries.push(entry);
    return clone(entry);
  }

  function claimDue({ limit = null } = {}) {
    const claimLimit = Number.isInteger(limit) ? Math.max(limit, 1) : null;
    const claimedAt = currentDate();
    const claimedIso = claimedAt.toISOString();
    const ordered = entries
      .filter((entry) => entry.status === 'scheduled' && Date.parse(entry.runAt) <= claimedAt.getTime())
      .sort((a, b) => a.runAt.localeCompare(b.runAt) || a.scheduleId.localeCompare(b.scheduleId));
    const due = claimLimit == null ? ordered : ordered.slice(0, claimLimit);

    for (const entry of due) {
      entry.status = 'running';
      entry.attempts += 1;
      entry.updatedAt = claimedIso;
    }
    return due.map(clone);
  }

  function complete(scheduleId) {
    const entry = find(scheduleId);
    if (entry.status !== 'running') throw new Error('INVALID_TASK_SCHEDULE_TRANSITION');
    entry.status = 'completed';
    entry.lastError = null;
    entry.updatedAt = currentDate().toISOString();
    return clone(entry);
  }

  function fail(scheduleId, { error = 'SCHEDULE_EXECUTION_FAILED', retryAt = null } = {}) {
    const entry = find(scheduleId);
    if (entry.status !== 'running') throw new Error('INVALID_TASK_SCHEDULE_TRANSITION');
    const safeError = cleanErrorCode(error);
    const updatedAt = currentDate();
    const canRetry = entry.attempts < entry.maxAttempts && retryAt != null;
    let nextRunAt = null;
    if (canRetry) {
      nextRunAt = toIso(retryAt, 'retryAt');
      if (Date.parse(nextRunAt) <= updatedAt.getTime()) throw new Error('INVALID_TASK_SCHEDULE:retryAt');
    }

    entry.lastError = safeError;
    entry.updatedAt = updatedAt.toISOString();
    if (canRetry) {
      entry.status = 'scheduled';
      entry.runAt = nextRunAt;
    } else {
      entry.status = 'failed';
    }
    return clone(entry);
  }

  function defer(scheduleId, { runAt, error = 'SCHEDULE_LEASE_BUSY' } = {}) {
    const entry = find(scheduleId);
    if (entry.status !== 'running' || entry.attempts < 1) throw new Error('INVALID_TASK_SCHEDULE_TRANSITION');
    const updatedAt = currentDate();
    const nextRunAt = toIso(runAt, 'runAt');
    if (Date.parse(nextRunAt) <= updatedAt.getTime()) throw new Error('INVALID_TASK_SCHEDULE:runAt');

    entry.status = 'scheduled';
    entry.attempts -= 1;
    entry.lastError = cleanErrorCode(error);
    entry.runAt = nextRunAt;
    entry.updatedAt = updatedAt.toISOString();
    return clone(entry);
  }

  function reschedule(scheduleId, { runAt } = {}) {
    const entry = find(scheduleId);
    if (entry.status !== 'scheduled') throw new Error('INVALID_TASK_SCHEDULE_TRANSITION');
    entry.runAt = toIso(runAt, 'runAt');
    entry.updatedAt = currentDate().toISOString();
    return clone(entry);
  }

  function cancel(scheduleId) {
    const entry = find(scheduleId);
    if (entry.status !== 'scheduled') throw new Error('INVALID_TASK_SCHEDULE_TRANSITION');
    entry.status = 'cancelled';
    entry.updatedAt = currentDate().toISOString();
    return clone(entry);
  }

  function read(scheduleId = null) {
    if (scheduleId == null) return snapshot();
    const id = cleanText(scheduleId, 'scheduleId', 120);
    const entry = entries.find((item) => item.scheduleId === id);
    return entry ? clone(entry) : null;
  }

  return Object.freeze({ add, claimDue, complete, fail, defer, reschedule, cancel, read, snapshot });
}
