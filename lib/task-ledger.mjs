/**
 * @typedef {'planned' | 'running' | 'completed' | 'failed' | 'blocked'} TaskLedgerStatus
 *
 * @typedef {object} TaskLedgerEntry
 * @property {string} taskId
 * @property {string} traceId
 * @property {string} agentId
 * @property {string} action
 * @property {TaskLedgerStatus} status
 * @property {string | null} detail
 * @property {string | null} parentTaskId
 * @property {string} createdAt
 * @property {string | null} updatedAt
 *
 * @typedef {{ traceId: string; entries: TaskLedgerEntry[] }} TaskLedgerSnapshot
 */

const DEFAULT_MAX_ENTRIES = 64;
const ALLOWED_STATUS = new Set(['planned', 'running', 'completed', 'failed', 'blocked']);

/**
 * @param {unknown} value
 * @param {string} label
 * @param {number} [maxLength]
 * @returns {string}
 */
function cleanText(value, label, maxLength = 1000) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength) throw new Error(`INVALID_TASK_LEDGER:${label}`);
  return text;
}

/**
 * @param {unknown} value
 * @param {string} label
 * @param {number} [maxLength]
 * @returns {string | null}
 */
function cleanOptionalText(value, label, maxLength = 2000) {
  if (value == null || value === '') return null;
  return cleanText(value, label, maxLength);
}

/**
 * Tek bir izleme kimliği altındaki görev kayıtlarını tutan sınırlı defter.
 *
 * @param {{ traceId?: string; maxEntries?: number; now?: () => Date }} [options]
 */
export function createTaskLedger({ traceId, maxEntries = DEFAULT_MAX_ENTRIES, now = () => new Date() } = {}) {
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

  /**
   * @param {{ agentId?: string; action?: string; status?: TaskLedgerStatus; detail?: unknown; parentTaskId?: string | null }} [input]
   * @returns {TaskLedgerEntry}
   */
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

  /**
   * @param {string} taskId
   * @param {{ status?: TaskLedgerStatus; detail?: unknown }} [patch]
   * @returns {TaskLedgerEntry}
   */
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

  /**
   * Kimlik verilmezse tüm defterin anlık görüntüsünü, verilirse tek kaydı
   * döndürür. İki davranış aşırı yükleme olarak yazılır; aksi hâlde her
   * çağıran yeri birleşim tipini daraltmak zorunda kalırdı.
   *
   * Dar imza önce yazılır: `any` bir argüman ilk eşleşen aşırı yüklemeyi
   * seçer.
   *
   * @overload
   * @param {string} taskId
   * @returns {TaskLedgerEntry | null}
   *
   * @overload
   * @param {null} [taskId]
   * @returns {TaskLedgerSnapshot}
   *
   * @param {string | null} [taskId]
   * @returns {TaskLedgerSnapshot | TaskLedgerEntry | null}
   */
  function read(taskId = null) {
    if (taskId == null) return snapshot();
    const id = cleanText(taskId, 'taskId', 120);
    const entry = entries.find((item) => item.taskId === id);
    return entry ? { ...entry } : null;
  }

  return Object.freeze({ add, update, read, snapshot });
}
