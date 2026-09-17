const DEFAULT_MAX_ENTRIES = 64;
const ALLOWED_STATUS = new Set(['planned', 'running', 'completed', 'failed', 'blocked'] as const);

export type TaskStatus = typeof ALLOWED_STATUS extends Set<infer T> ? T & string : never;

export interface TaskLedgerEntry {
  readonly taskId: string;
  readonly traceId: string;
  readonly agentId: string;
  readonly action: string;
  readonly status: TaskStatus;
  readonly detail: string | null;
  readonly parentTaskId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string | null;
}

export interface TaskLedger {
  readonly add: (input?: Partial<{ agentId: unknown; action: unknown; status: unknown; detail: unknown; parentTaskId: unknown }>) => TaskLedgerEntry;
  readonly update: (taskId: unknown, input?: Partial<{ status: unknown; detail: unknown }>) => TaskLedgerEntry;
  readonly read: (taskId?: unknown) => TaskLedgerEntry | { readonly traceId: string; readonly entries: readonly TaskLedgerEntry[] } | null;
  readonly snapshot: () => { readonly traceId: string; readonly entries: readonly TaskLedgerEntry[] };
}

interface TaskEntryMutable extends TaskLedgerEntry {
  status: TaskStatus;
  detail: string | null;
  updatedAt: string | null;
}

function cleanText(value: unknown, label: string, maxLength = 1000): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength) throw new Error(`INVALID_TASK_LEDGER:${label}`);
  return text;
}

function cleanOptionalText(value: unknown, label: string, maxLength = 2000): string | null {
  if (value == null || value === '') return null;
  return cleanText(value, label, maxLength);
}

const asStatus = (value: unknown): TaskStatus => {
  if (typeof value !== 'string' || !ALLOWED_STATUS.has(value as TaskStatus)) throw new Error('INVALID_TASK_LEDGER:status');
  return value as TaskStatus;
};

export function createTaskLedger(options: { readonly traceId?: unknown; readonly maxEntries?: unknown; readonly now?: () => Date } = {}): TaskLedger {
  const safeTraceId = cleanText(options.traceId, 'traceId', 128);
  const limit = Number.isInteger(options.maxEntries) ? Math.min(Math.max(Number(options.maxEntries), 1), 256) : DEFAULT_MAX_ENTRIES;
  const now = options.now ?? (() => new Date());
  const entries: TaskEntryMutable[] = [];
  let nextId = 1;

  const snapshot = (): { readonly traceId: string; readonly entries: readonly TaskLedgerEntry[] } => Object.freeze({
    traceId: safeTraceId,
    entries: Object.freeze(entries.map((entry) => Object.freeze({ ...entry })))
  });

  function add(input: { readonly agentId?: unknown; readonly action?: unknown; readonly status?: unknown; readonly detail?: unknown; readonly parentTaskId?: unknown } = {}): TaskLedgerEntry {
    if (entries.length >= limit) throw new Error('TASK_LEDGER_FULL');
    const status = asStatus(input.status ?? 'planned');
    const entry: TaskEntryMutable = {
      taskId: `task_${nextId++}`,
      traceId: safeTraceId,
      agentId: cleanText(input.agentId, 'agentId', 120),
      action: cleanText(input.action, 'action', 1000),
      status,
      detail: cleanOptionalText(input.detail, 'detail'),
      parentTaskId: input.parentTaskId == null ? null : cleanText(input.parentTaskId, 'parentTaskId', 120),
      createdAt: now().toISOString(),
      updatedAt: null
    };
    entries.push(entry);
    return Object.freeze({ ...entry });
  }

  function update(taskId: unknown, input: { readonly status?: unknown; readonly detail?: unknown } = {}): TaskLedgerEntry {
    const id = cleanText(taskId, 'taskId', 120);
    const entry = entries.find((item) => item.taskId === id);
    if (!entry) throw new Error('TASK_LEDGER_NOT_FOUND');
    if (input.status != null) entry.status = asStatus(input.status);
    if (input.detail !== undefined) entry.detail = cleanOptionalText(input.detail, 'detail');
    entry.updatedAt = now().toISOString();
    return Object.freeze({ ...entry });
  }

  function read(taskId?: unknown): TaskLedgerEntry | { readonly traceId: string; readonly entries: readonly TaskLedgerEntry[] } | null {
    if (taskId == null) return snapshot();
    const id = cleanText(taskId, 'taskId', 120);
    const entry = entries.find((item) => item.taskId === id);
    return entry ? Object.freeze({ ...entry }) : null;
  }

  return Object.freeze({ add, update, read, snapshot });
}
