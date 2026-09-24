export type TaskLedgerStatus = 'planned' | 'running' | 'completed' | 'failed' | 'blocked';

export type TaskLedgerEntry = Readonly<{
  taskId: string;
  traceId: string;
  agentId: string;
  action: string;
  status: TaskLedgerStatus;
  detail: string | null;
  parentTaskId: string | null;
  createdAt: string;
  updatedAt: string | null;
}>;

export type TaskLedgerSnapshot = { traceId: string; entries: TaskLedgerEntry[] };


const DEFAULT_MAX_ENTRIES = 64;
const ALLOWED_STATUS = new Set(['planned', 'running', 'completed', 'failed', 'blocked']);

function cleanText(value: unknown, label: string, maxLength: number = 1000): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength) throw new Error(`INVALID_TASK_LEDGER:${label}`);
  return text;
}

function cleanOptionalText(value: unknown, label: string, maxLength: number = 2000): string | null {
  if (value == null || value === '') return null;
  return cleanText(value, label, maxLength);
}

/**
 * Tek bir izleme kimliği altındaki görev kayıtlarını tutan sınırlı defter.
 */
export function createTaskLedger({ traceId, maxEntries = DEFAULT_MAX_ENTRIES, now = () => new Date() }: { traceId?: string; maxEntries?: number; now?: () => Date } = {}) {
  const safeTraceId = cleanText(traceId, 'traceId', 128);
  const limit = Number.isInteger(maxEntries) ? Math.min(Math.max(maxEntries, 1), 256) : DEFAULT_MAX_ENTRIES;
  const entries = [];
  let nextId = 1;

  /** @returns {TaskLedgerSnapshot} */
  function snapshot() {
    return {
      traceId: safeTraceId,
      entries: entries.map((entry) => ({ ...entry }))
    };
  }

  function add({ agentId, action, status = 'planned', detail = null, parentTaskId = null }: { agentId?: string; action?: string; status?: TaskLedgerStatus; detail?: unknown; parentTaskId?: string | null } = {}): TaskLedgerEntry {
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

  function update(taskId: string, { status, detail }: { status?: TaskLedgerStatus; detail?: unknown } = {}): TaskLedgerEntry {
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

/**
 * Kimlik verilmezse tüm defterin anlık görüntüsünü, verilirse tek kaydı
 * döndürür. İki davranış aşırı yükleme olarak yazılır; aksi hâlde her
 * çağıran yeri birleşim tipini daraltmak zorunda kalırdı.
 * Dar imza önce yazılır: `any` bir argüman ilk eşleşen aşırı yüklemeyi
 * seçer.
 */
  function read(taskId: string): TaskLedgerEntry | null;
  function read(taskId?: null): TaskLedgerSnapshot;
  function read(taskId: string | null = null): TaskLedgerSnapshot | TaskLedgerEntry | null {
    if (taskId == null) return snapshot();
    const id = cleanText(taskId, 'taskId', 120);
    const entry = entries.find((item) => item.taskId === id);
    return entry ? { ...entry } : null;
  }

  return Object.freeze({ add, update, read, snapshot });
}
