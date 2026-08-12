const DEFAULT_MAX_ENTRIES = 128;
const DEFAULT_MAX_ATTEMPTS = 1;
const MAX_ATTEMPTS = 5;
const MAX_CLAIM_BATCH = 16;
const ADD_FIELDS = new Set(['traceId', 'agentId', 'task', 'runAt', 'maxAttempts', 'ownerId']);

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

export function createTaskScheduleStore({ maxEntries = DEFAULT_MAX_ENTRIES, now = () => new Date() } = {}) {
  const capacity = Number.isInteger(maxEntries)
    ? Math.min(Math.max(maxEntries, 1), 1024)
    : DEFAULT_MAX_ENTRIES;
  const entries = [];
  let nextId = 1;

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
    if (entries.length >= capacity) throw new Error('TASK_SCHEDULE_FULL');
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

  function claimDue({ limit = 1 } = {}) {
    const claimLimit = Number.isInteger(limit)
      ? Math.min(Math.max(limit, 1), MAX_CLAIM_BATCH)
      : 1;
    const claimedAt = currentDate();
    const claimedIso = claimedAt.toISOString();
    const due = entries
      .filter((entry) => entry.status === 'scheduled' && Date.parse(entry.runAt) <= claimedAt.getTime())
      .sort((a, b) => a.runAt.localeCompare(b.runAt) || a.scheduleId.localeCompare(b.scheduleId))
      .slice(0, claimLimit);

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

  return Object.freeze({ add, claimDue, complete, fail, cancel, read, snapshot });
}
