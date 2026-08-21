const DEFAULT_MAX_ENTRIES = 64;
const ALLOWED_STATUS = new Set(['planned', 'running', 'completed', 'failed', 'blocked']);
const TERMINAL_STATUS = new Set(['completed', 'failed', 'blocked']);
const ALLOWED_TRANSITIONS = Object.freeze({
  planned: new Set(['planned', 'running', 'completed', 'failed', 'blocked']),
  running: new Set(['running', 'completed', 'failed', 'blocked']),
  completed: new Set(['completed']),
  failed: new Set(['failed']),
  blocked: new Set(['blocked'])
});

function cleanText(value, label, maxLength = 1000) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength) throw new Error(`INVALID_TASK_LEDGER:${label}`);
  return text;
}

function cleanOptionalText(value, label, maxLength = 2000) {
  if (value == null || value === '') return null;
  return cleanText(value, label, maxLength);
}

function sameNullableText(left, right) {
  return (left ?? null) === (right ?? null);
}

export function createTaskLedger({ traceId, maxEntries = DEFAULT_MAX_ENTRIES, now = () => new Date() } = {}) {
  const safeTraceId = cleanText(traceId, 'traceId', 128);
  const limit = Number.isInteger(maxEntries) ? Math.min(Math.max(maxEntries, 1), 256) : DEFAULT_MAX_ENTRIES;
  if (typeof now !== 'function') throw new Error('INVALID_TASK_LEDGER:now');

  const entries = [];
  let nextId = 1;

  function snapshot() {
    return {
      traceId: safeTraceId,
      entries: entries.map((entry) => ({ ...entry }))
    };
  }

  function findEntry(taskId) {
    const id = cleanText(taskId, 'taskId', 120);
    return entries.find((item) => item.taskId === id) ?? null;
  }

  function requireParent(parentTaskId) {
    if (parentTaskId == null) return null;
    const id = cleanText(parentTaskId, 'parentTaskId', 120);
    const parent = entries.find((item) => item.taskId === id);
    if (!parent) throw new Error('TASK_LEDGER_PARENT_NOT_FOUND');
    return parent;
  }

  function add({ agentId, action, status = 'planned', detail = null, parentTaskId = null } = {}) {
    if (entries.length >= limit) throw new Error('TASK_LEDGER_FULL');
    if (!ALLOWED_STATUS.has(status)) throw new Error('INVALID_TASK_LEDGER:status');

    const parent = requireParent(parentTaskId);
    const timestamp = now();
    if (!(timestamp instanceof Date) || !Number.isFinite(timestamp.getTime())) throw new Error('INVALID_TASK_LEDGER:now');

    const entry = {
      taskId: `task_${nextId++}`,
      traceId: safeTraceId,
      agentId: cleanText(agentId, 'agentId', 120),
      action: cleanText(action, 'action', 1000),
      status,
      detail: cleanOptionalText(detail, 'detail'),
      parentTaskId: parent?.taskId ?? null,
      createdAt: timestamp.toISOString(),
      updatedAt: null
    };
    entries.push(entry);
    return { ...entry };
  }

  function update(taskId, { status, detail } = {}) {
    const entry = findEntry(taskId);
    if (!entry) throw new Error('TASK_LEDGER_NOT_FOUND');

    const nextStatus = status == null ? entry.status : status;
    if (!ALLOWED_STATUS.has(nextStatus)) throw new Error('INVALID_TASK_LEDGER:status');
    if (!ALLOWED_TRANSITIONS[entry.status]?.has(nextStatus)) throw new Error('TASK_LEDGER_INVALID_TRANSITION');

    const nextDetail = detail === undefined ? entry.detail : cleanOptionalText(detail, 'detail');
    if (TERMINAL_STATUS.has(entry.status)) {
      if (nextStatus !== entry.status || !sameNullableText(nextDetail, entry.detail)) {
        throw new Error('TASK_LEDGER_TERMINAL_IMMUTABLE');
      }
      return { ...entry };
    }

    if (nextStatus === entry.status && sameNullableText(nextDetail, entry.detail)) return { ...entry };

    const timestamp = now();
    if (!(timestamp instanceof Date) || !Number.isFinite(timestamp.getTime())) throw new Error('INVALID_TASK_LEDGER:now');
    entry.status = nextStatus;
    entry.detail = nextDetail;
    entry.updatedAt = timestamp.toISOString();
    return { ...entry };
  }

  function read(taskId = null) {
    if (taskId == null) return snapshot();
    const entry = findEntry(taskId);
    return entry ? { ...entry } : null;
  }

  return Object.freeze({ add, update, read, snapshot });
}
