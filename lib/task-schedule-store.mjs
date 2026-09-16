const DEFAULT_MAX_ENTRIES = Number.POSITIVE_INFINITY;
const DEFAULT_MAX_ATTEMPTS = 1;
const MAX_ATTEMPTS = 5;
const MAX_CLAIM_BATCH = 64;
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
const MAX_QUERY = 160;
const MAX_CURSOR = 1024;
const MAX_BULK_CANCEL = 100;
const ADD_FIELDS = new Set(['traceId', 'agentId', 'task', 'runAt', 'maxAttempts', 'ownerId']);
const SNAPSHOT_FIELDS = new Set(['entries']);
const ENTRY_FIELDS = new Set(['scheduleId', 'traceId', 'ownerId', 'agentId', 'task', 'runAt', 'status', 'attempts', 'maxAttempts', 'lastError', 'createdAt', 'updatedAt']);
const STATUSES = new Set(['scheduled', 'running', 'completed', 'failed', 'cancelled']);
const SORTS = new Set(['runAt-asc', 'created-desc', 'updated-desc']);

function cleanText(value, label, maxLength) { const text = typeof value === 'string' ? value.trim() : ''; if (!text || text.length > maxLength) throw new Error(`INVALID_TASK_SCHEDULE:${label}`); return text; }
function cleanErrorCode(value) { const code = cleanText(value, 'error', 120); if (!/^[A-Z0-9_:-]+$/.test(code)) throw new Error('INVALID_TASK_SCHEDULE:error'); return code; }
function toIso(value, label) { const date = value instanceof Date ? new Date(value.getTime()) : new Date(value); if (Number.isNaN(date.getTime())) throw new Error(`INVALID_TASK_SCHEDULE:${label}`); return date.toISOString(); }
const clone = (entry) => ({ ...entry });
function normalizeCapacity(value) { if (value == null || value === Number.POSITIVE_INFINITY) return DEFAULT_MAX_ENTRIES; if (!Number.isInteger(value) || value < 1) throw new Error('INVALID_TASK_SCHEDULE:maxEntries'); return value; }
function normalizeLimit(value) { if (value == null) return DEFAULT_LIST_LIMIT; if (!Number.isInteger(value)) throw new Error('INVALID_TASK_SCHEDULE:limit'); return Math.min(Math.max(value, 1), MAX_LIST_LIMIT); }
function normalizeQuery(value) { return typeof value === 'string' ? value.trim().slice(0, MAX_QUERY) : ''; }
function normalizeStatus(value) { const status = value == null || value === '' ? 'all' : String(value).trim(); if (status !== 'all' && !STATUSES.has(status)) throw new Error('INVALID_TASK_SCHEDULE:statusFilter'); return status; }
function normalizeSort(value) { const sort = value == null || value === '' ? 'runAt-asc' : String(value).trim(); if (!SORTS.has(sort)) throw new Error('INVALID_TASK_SCHEDULE:sort'); return sort; }
function encodeCursor(value) { return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url'); }
function decodeCursor(value) { if (value == null || value === '') return null; if (typeof value !== 'string' || value.length > MAX_CURSOR) throw new Error('INVALID_TASK_SCHEDULE:cursor'); try { const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); if (!decoded || typeof decoded !== 'object' || !SORTS.has(decoded.sort) || typeof decoded.id !== 'string' || typeof decoded.key !== 'string') throw new Error(); return decoded; } catch { throw new Error('INVALID_TASK_SCHEDULE:cursor'); } }
function scheduleNumber(scheduleId) { const match = /^schedule_([1-9][0-9]*)$/.exec(scheduleId); if (!match) return null; try { return BigInt(match[1]); } catch { return null; } }
function restoreSnapshot(initialSnapshot, capacity) {
  if (initialSnapshot == null) return [];
  if (!initialSnapshot || Array.isArray(initialSnapshot) || typeof initialSnapshot !== 'object') throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:input');
  for (const key of Object.keys(initialSnapshot)) if (!SNAPSHOT_FIELDS.has(key)) throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:field');
  if (!Array.isArray(initialSnapshot.entries)) throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:entries');
  if (Number.isFinite(capacity) && initialSnapshot.entries.length > capacity) throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:capacity');
  const ids = new Set();
  return initialSnapshot.entries.map((raw) => {
    if (!raw || Array.isArray(raw) || typeof raw !== 'object') throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:entry');
    for (const key of Object.keys(raw)) if (!ENTRY_FIELDS.has(key)) throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:entry_field');
    const scheduleId = cleanText(raw.scheduleId, 'scheduleId', 120); if (scheduleNumber(scheduleId) == null || ids.has(scheduleId)) throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:scheduleId'); ids.add(scheduleId);
    const maxAttempts = raw.maxAttempts; const attempts = raw.attempts;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAX_ATTEMPTS) throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:maxAttempts');
    if (!Number.isInteger(attempts) || attempts < 0 || attempts > maxAttempts) throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:attempts');
    if (!STATUSES.has(raw.status)) throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:status');
    if (raw.status === 'scheduled' && attempts >= maxAttempts) throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:attempts');
    if ((raw.status === 'running' || raw.status === 'completed' || raw.status === 'failed') && attempts < 1) throw new Error('INVALID_TASK_SCHEDULE_SNAPSHOT:attempts');
    return { scheduleId, traceId: cleanText(raw.traceId, 'traceId', 128), ownerId: raw.ownerId == null ? null : cleanText(raw.ownerId, 'ownerId', 200), agentId: cleanText(raw.agentId, 'agentId', 120), task: cleanText(raw.task, 'task', 20000), runAt: toIso(raw.runAt, 'runAt'), status: raw.status, attempts, maxAttempts, lastError: raw.lastError == null ? null : cleanErrorCode(raw.lastError), createdAt: toIso(raw.createdAt, 'createdAt'), updatedAt: raw.updatedAt == null ? null : toIso(raw.updatedAt, 'updatedAt') };
  });
}
function nextScheduleNumber(entries) { let max = 0n; for (const entry of entries) { const numeric = scheduleNumber(entry.scheduleId); if (numeric != null && numeric > max) max = numeric; } return max + 1n; }
function searchable(entry) { return [entry.scheduleId, entry.agentId, entry.task, entry.status, entry.lastError || ''].join('\n').toLocaleLowerCase('tr-TR'); }
function compareScheduleIds(a, b) { const left = scheduleNumber(a); const right = scheduleNumber(b); if (left != null && right != null) return left < right ? -1 : left > right ? 1 : 0; return a.localeCompare(b); }
function compareEntries(a, b, sort) { if (sort === 'created-desc') return b.createdAt.localeCompare(a.createdAt) || compareScheduleIds(a.scheduleId, b.scheduleId); if (sort === 'updated-desc') return (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt) || compareScheduleIds(a.scheduleId, b.scheduleId); return a.runAt.localeCompare(b.runAt) || compareScheduleIds(a.scheduleId, b.scheduleId); }
function cursorKey(entry, sort) { return sort === 'created-desc' ? entry.createdAt : sort === 'updated-desc' ? (entry.updatedAt || entry.createdAt) : entry.runAt; }
function afterCursor(entry, cursor) { if (!cursor) return true; const key = cursorKey(entry, cursor.sort); if (cursor.sort === 'runAt-asc') return key > cursor.key || (key === cursor.key && compareScheduleIds(entry.scheduleId, cursor.id) > 0); return key < cursor.key || (key === cursor.key && compareScheduleIds(entry.scheduleId, cursor.id) > 0); }
function summarize(entries, ownerId = null) {
  const counts = { scheduled: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
  let total = 0; let retrying = 0; let due = 0; const now = Date.now();
  for (const entry of entries) {
    if (ownerId != null && entry.ownerId !== ownerId) continue;
    total += 1; counts[entry.status] += 1;
    if (entry.status === 'scheduled' && Date.parse(entry.runAt) <= now) due += 1;
    if (entry.status === 'scheduled' && entry.attempts > 0 && entry.attempts < entry.maxAttempts) retrying += 1;
  }
  return { total, counts, due, retrying, capacity: Number.isFinite(Infinity) ? 'unbounded' : 'bounded' };
}

export function createTaskScheduleStore({ maxEntries, now = () => new Date(), initialSnapshot = null } = {}) {
  const capacity = normalizeCapacity(maxEntries); const entries = restoreSnapshot(initialSnapshot, capacity); let nextId = nextScheduleNumber(entries);
  function currentDate() { const value = now(); const date = value instanceof Date ? new Date(value.getTime()) : new Date(value); if (Number.isNaN(date.getTime())) throw new Error('INVALID_TASK_SCHEDULE:now'); return date; }
  function find(scheduleId) { const id = cleanText(scheduleId, 'scheduleId', 120); const entry = entries.find((item) => item.scheduleId === id); if (!entry) throw new Error('TASK_SCHEDULE_NOT_FOUND'); return entry; }
  function snapshot() { return { entries: entries.map(clone) }; }
  function add(input = {}) {
    if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('INVALID_TASK_SCHEDULE:input'); for (const key of Object.keys(input)) if (!ADD_FIELDS.has(key)) throw new Error('INVALID_TASK_SCHEDULE:field');
    const { traceId, agentId, task, runAt, maxAttempts = DEFAULT_MAX_ATTEMPTS, ownerId = null } = input; if (Number.isFinite(capacity) && entries.length >= capacity) throw new Error('TASK_SCHEDULE_FULL');
    const attempts = Number.isInteger(maxAttempts) ? Math.min(Math.max(maxAttempts, 1), MAX_ATTEMPTS) : DEFAULT_MAX_ATTEMPTS; const createdAt = currentDate().toISOString();
    const entry = { scheduleId: `schedule_${nextId++}`, traceId: cleanText(traceId, 'traceId', 128), ownerId: ownerId == null ? null : cleanText(ownerId, 'ownerId', 200), agentId: cleanText(agentId, 'agentId', 120), task: cleanText(task, 'task', 20000), runAt: toIso(runAt, 'runAt'), status: 'scheduled', attempts: 0, maxAttempts: attempts, lastError: null, createdAt, updatedAt: null };
    entries.push(entry); return clone(entry);
  }
  function claimDue({ limit = 1 } = {}) { const claimLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), MAX_CLAIM_BATCH) : 1; const claimedAt = currentDate(); const claimedIso = claimedAt.toISOString(); const due = entries.filter((entry) => entry.status === 'scheduled' && Date.parse(entry.runAt) <= claimedAt.getTime()).sort((a, b) => compareEntries(a, b, 'runAt-asc')).slice(0, claimLimit); for (const entry of due) { entry.status = 'running'; entry.attempts += 1; entry.updatedAt = claimedIso; } return due.map(clone); }
  function complete(scheduleId) { const entry = find(scheduleId); if (entry.status !== 'running') throw new Error('INVALID_TASK_SCHEDULE_TRANSITION'); entry.status = 'completed'; entry.lastError = null; entry.updatedAt = currentDate().toISOString(); return clone(entry); }
  function fail(scheduleId, { error = 'SCHEDULE_EXECUTION_FAILED', retryAt = null } = {}) { const entry = find(scheduleId); if (entry.status !== 'running') throw new Error('INVALID_TASK_SCHEDULE_TRANSITION'); const safeError = cleanErrorCode(error); const updatedAt = currentDate(); const canRetry = entry.attempts < entry.maxAttempts && retryAt != null; let nextRunAt = null; if (canRetry) { nextRunAt = toIso(retryAt, 'retryAt'); if (Date.parse(nextRunAt) <= updatedAt.getTime()) throw new Error('INVALID_TASK_SCHEDULE:retryAt'); } entry.lastError = safeError; entry.updatedAt = updatedAt.toISOString(); if (canRetry) { entry.status = 'scheduled'; entry.runAt = nextRunAt; } else entry.status = 'failed'; return clone(entry); }
  function defer(scheduleId, { runAt, error = 'SCHEDULE_LEASE_BUSY' } = {}) { const entry = find(scheduleId); if (entry.status !== 'running' || entry.attempts < 1) throw new Error('INVALID_TASK_SCHEDULE_TRANSITION'); const updatedAt = currentDate(); const nextRunAt = toIso(runAt, 'runAt'); if (Date.parse(nextRunAt) <= updatedAt.getTime()) throw new Error('INVALID_TASK_SCHEDULE:runAt'); entry.status = 'scheduled'; entry.attempts -= 1; entry.lastError = cleanErrorCode(error); entry.runAt = nextRunAt; entry.updatedAt = updatedAt.toISOString(); return clone(entry); }
  function cancel(scheduleId) { const entry = find(scheduleId); if (entry.status !== 'scheduled') throw new Error('INVALID_TASK_SCHEDULE_TRANSITION'); entry.status = 'cancelled'; entry.updatedAt = currentDate().toISOString(); return clone(entry); }
  function cancelMany(scheduleIds = [], ownerId = null) { if (!Array.isArray(scheduleIds) || scheduleIds.length < 1 || scheduleIds.length > MAX_BULK_CANCEL) throw new Error('INVALID_TASK_SCHEDULE:scheduleIds'); const uniqueIds = [...new Set(scheduleIds.map((value) => typeof value === 'string' ? value.trim() : '').filter(Boolean))]; if (!uniqueIds.length || uniqueIds.length > MAX_BULK_CANCEL) throw new Error('INVALID_TASK_SCHEDULE:scheduleIds'); const nowIso = currentDate().toISOString(); const selected = new Set(uniqueIds); const updated = []; for (const entry of entries) { if (selected.has(entry.scheduleId) && (ownerId == null || entry.ownerId === ownerId) && entry.status === 'scheduled') { entry.status = 'cancelled'; entry.updatedAt = nowIso; updated.push(clone(entry)); } } return updated; }
  function list({ ownerId = null, status = 'all', q = '', limit = DEFAULT_LIST_LIMIT, cursor = null, sort = 'runAt-asc' } = {}) { const safeStatus = normalizeStatus(status); const safeQuery = normalizeQuery(q); const safeLimit = normalizeLimit(limit); const safeSort = normalizeSort(sort); const safeCursor = decodeCursor(cursor); if (safeCursor && safeCursor.sort !== safeSort) throw new Error('INVALID_TASK_SCHEDULE:cursor'); const query = safeQuery.toLocaleLowerCase('tr-TR'); const filtered = entries.filter((entry) => (ownerId == null || entry.ownerId === ownerId) && (safeStatus === 'all' || entry.status === safeStatus) && (!query || searchable(entry).includes(query))).sort((a, b) => compareEntries(a, b, safeSort)); const total = filtered.length; const start = safeCursor ? filtered.findIndex((entry) => afterCursor(entry, safeCursor)) : 0; const offset = start < 0 ? total : start; const page = filtered.slice(offset, offset + safeLimit); const hasMore = offset + page.length < total; const last = page.at(-1); const nextCursor = hasMore && last ? encodeCursor({ sort: safeSort, key: cursorKey(last, safeSort), id: last.scheduleId }) : null; return { entries: page.map(clone), total, hasMore, nextCursor }; }
  function stats(ownerId = null) { return summarize(entries, ownerId); }
  function read(scheduleId = null) { if (scheduleId == null) return snapshot(); const id = cleanText(scheduleId, 'scheduleId', 120); const entry = entries.find((item) => item.scheduleId === id); return entry ? clone(entry) : null; }
  return Object.freeze({ add, claimDue, complete, fail, defer, cancel, cancelMany, list, stats, read, snapshot, capacity });
}
