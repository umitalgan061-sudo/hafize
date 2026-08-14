const DEFAULT_MAX_ENTRIES = 64;
const ALLOWED_STATUS = new Set(['planned', 'running', 'completed', 'failed', 'blocked']);

function cleanText(value, label, maxLength = 1000) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength) throw new Error(`INVALID_TASK_LEDGER:${label}`);
  return text;
}

function cleanOptionalText(value, label, maxLength = 2000) {
  if (value == null || value === '') return null;
  return cleanText(value, label, maxLength);
}

export function createTaskLedger({ traceId, maxEntries = DEFAULT_MAX_ENTRIES, now = () => new Date() } = {}) {
  const safeTraceId = cleanText(traceId, 'traceId', 128);
  const limit = Number.isInteger(maxEntries) ? Math.min(Math.max(maxEntries, 1), 256) : DEFAULT_MAX_ENTRIES;
  const entries = [];
  let nextId = 1;

  function snapshot() {
    return {
      traceId: safeTraceId,
      entries: entries.map((entry) => ({ ...entry }))
    };
  }

  function add({ agentId, action, status = 'planned', detail = null, parentTaskId = null } = {}) {
    if (entries.length >= limit) throw new Error('TASK_LEDGER_FULL');
    if (!ALLOWED_STATUS.has(status)) throw new Error('INVALID_TASK_LEDGER:status');

    const entry = {
      taskId: `task_${nextId++}`,
      traceId: safeTraceId,
      agentId: cleanText(agentId, 'agentId', 120),
      action: cleanText(action, 'action', 1000),
      status,
      detail: cleanOptionalText(detail, 'detail'),
      parentTaskId: parentTaskId == null ? null : cleanText(parentTaskId, 'parentTaskId', 120),
      createdAt: now().toISOString(),
      updatedAt: null
    };
    entries.push(entry);
    return { ...entry };
  }

  function update(taskId, { status, detail } = {}) {
    const id = cleanText(taskId, 'taskId', 120);
    const entry = entries.find((item) => item.taskId === id);
    if (!entry) throw new Error('TASK_LEDGER_NOT_FOUND');
    if (status != null) {
      if (!ALLOWED_STATUS.has(status)) throw new Error('INVALID_TASK_LEDGER:status');
      entry.status = status;
    }
    if (detail !== undefined) entry.detail = cleanOptionalText(detail, 'detail');
    entry.updatedAt = now().toISOString();
    return { ...entry };
  }

  function read(taskId = null) {
    if (taskId == null) return snapshot();
    const id = cleanText(taskId, 'taskId', 120);
    const entry = entries.find((item) => item.taskId === id);
    return entry ? { ...entry } : null;
  }

  return Object.freeze({ add, update, read, snapshot });
}
