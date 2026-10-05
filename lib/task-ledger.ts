const DEFAULT_MAX_ENTRIES = 64;
const ALLOWED_STATUS = new Set(['planned', 'running', 'completed', 'failed', 'blocked'] as const);

export type TaskLedgerStatus = 'planned' | 'running' | 'completed' | 'failed' | 'blocked';

export interface TaskLedgerEntry {
  readonly taskId: string;
  readonly traceId: string;
  readonly agentId: string;
  readonly action: string;
  readonly status: TaskLedgerStatus;
  readonly detail: string | null;
  readonly parentTaskId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string | null;
}
export interface TaskLedgerSnapshot {
  readonly traceId: string;
  readonly entries: readonly TaskLedgerEntry[];
}
export interface TaskLedgerOptions {
  readonly traceId?: unknown;
  readonly maxEntries?: unknown;
  readonly now?: () => Date | string | number;
}
export interface TaskLedgerAddInput {
  readonly agentId?: unknown;
  readonly action?: unknown;
  readonly status?: unknown;
  readonly detail?: unknown;
  readonly parentTaskId?: unknown;
}
export interface TaskLedgerUpdateInput {
  readonly status?: unknown;
  readonly detail?: unknown;
}
function cleanText(value: unknown, label: string, maxLength = 1000): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength) throw new Error('INVALID_TASK_LEDGER:' + label);
  return text;
}
function cleanOptionalText(value: unknown, label: string, maxLength = 2000): string | null {
  if (value == null || value === '') return null;
  return cleanText(value, label, maxLength);
}
function toIso(now: () => Date | string | number): string {
  const raw = now();
  const date = raw instanceof Date ? new Date(raw.getTime()) : new Date(raw);
  if (!Number.isFinite(date.getTime())) throw new Error('INVALID_TASK_LEDGER:now');
  return date.toISOString();
}
export function createTaskLedger({
  traceId,
  maxEntries = DEFAULT_MAX_ENTRIES,
  now = () => new Date()
}: TaskLedgerOptions = {}) {
  const safeTraceId = cleanText(traceId, 'traceId', 128);
  const limit = Number.isInteger(maxEntries)
    ? Math.min(Math.max(Number(maxEntries), 1), 256)
    : DEFAULT_MAX_ENTRIES;
  const entries: TaskLedgerEntry[] = [];
  let nextId = 1;

  function snapshot(): TaskLedgerSnapshot {
    return Object.freeze({
      traceId: safeTraceId,
      entries: Object.freeze(entries.map((entry) => Object.freeze({ ...entry })))
    });
  }
  function add({
    agentId,
    action,
    status = 'planned',
    detail = null,
    parentTaskId = null
  }: TaskLedgerAddInput = {}): TaskLedgerEntry {
    if (entries.length >= limit) throw new Error('TASK_LEDGER_FULL');
    if (typeof status !== 'string' || !ALLOWED_STATUS.has(status as TaskLedgerStatus)) {
      throw new Error('INVALID_TASK_LEDGER:status');
    }
    const entry: TaskLedgerEntry = {
      taskId: 'task_' + nextId++,
      traceId: safeTraceId,
      agentId: cleanText(agentId, 'agentId', 120),
      action: cleanText(action, 'action', 1000),
      status: status as TaskLedgerStatus,
      detail: cleanOptionalText(detail, 'detail'),
      parentTaskId: parentTaskId == null ? null : cleanText(parentTaskId, 'parentTaskId', 120),
      createdAt: toIso(now),
      updatedAt: null
    };
    entries.push(entry);
    return Object.freeze({ ...entry });
  }
  function update(taskId: unknown, { status, detail }: TaskLedgerUpdateInput = {}): TaskLedgerEntry {
    const id = cleanText(taskId, 'taskId', 120);
    const index = entries.findIndex((item) => item.taskId === id);
    const previous = index >= 0 ? entries[index] : undefined;
    if (!previous) throw new Error('TASK_LEDGER_NOT_FOUND');
    let next: TaskLedgerEntry = previous;
    if (status != null) {
      if (typeof status !== 'string' || !ALLOWED_STATUS.has(status as TaskLedgerStatus)) {
        throw new Error('INVALID_TASK_LEDGER:status');
      }
      next = { ...next, status: status as TaskLedgerStatus };
    }
    if (detail !== undefined) next = { ...next, detail: cleanOptionalText(detail, 'detail') };
    next = { ...next, updatedAt: toIso(now) };
    entries[index] = next;
    return Object.freeze({ ...next });
  }
  function read(taskId: unknown = null): TaskLedgerEntry | TaskLedgerSnapshot | null {
    if (taskId == null) return snapshot();
    const id = cleanText(taskId, 'taskId', 120);
    const entry = entries.find((item) => item.taskId === id);
    return entry ? Object.freeze({ ...entry }) : null;
  }
  return Object.freeze({ add, update, read, snapshot });
}
