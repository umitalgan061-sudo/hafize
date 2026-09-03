const RUN_FIELDS = new Set(['taskId', 'agentId']);
const ACTIVE_STATE = 'running';
const FINAL_STATES = new Set(['completed', 'failed', 'cancelled']);
const MAX_CONCURRENT = 8;
const MAX_RUNS = 64;
const MAX_INBOX = 8;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_REASON_LENGTH = 120;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function failed(error) {
  return { ok: false, error };
}

function identifier(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > 120) fail('INVALID_AGENT_RUN');
  return text;
}

function strictRun(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') fail('INVALID_AGENT_RUN');
  for (const field of Object.keys(value)) if (!RUN_FIELDS.has(field)) fail('INVALID_AGENT_RUN_FIELD');
  return { taskId: identifier(value.taskId), agentId: identifier(value.agentId) };
}

/** Sonuç kodları dışarıya sızdırılmadan önce sabit uzunluğa indirilir. */
function safeReason(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && text.length <= MAX_REASON_LENGTH ? text : fallback;
}

/**
 * Alt ajan koşularının yaşam döngüsünü tutar: açık iptal durumu, sınırlı
 * eşzamanlılık ve yalnızca çalışan koşuya mesaj kabulü.
 *
 * Bu katman yetki vermez; hangi ajanın hangi aracı çağırabileceği registry
 * tool policy'sinde kalır. Burada yalnızca "bu koşu hâlâ yaşıyor mu" sorusu
 * fail-closed yanıtlanır.
 */
export function createAgentLifecycle({ maxConcurrent = 2, parentSignal = null, now = () => new Date() } = {}) {
  if (typeof now !== 'function') fail('INVALID_AGENT_LIFECYCLE:now');
  if (parentSignal != null && typeof parentSignal.addEventListener !== 'function') {
    fail('INVALID_AGENT_LIFECYCLE:parentSignal');
  }
  const concurrencyLimit = Number.isInteger(maxConcurrent) ? Math.min(Math.max(maxConcurrent, 1), MAX_CONCURRENT) : 2;
  const runs = new Map();
  let stopped = false;
  let stoppedReason = null;

  function view(run) {
    return Object.freeze({
      taskId: run.taskId,
      agentId: run.agentId,
      state: run.state,
      reason: run.reason,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      pendingMessages: run.inbox.length
    });
  }

  function lookup(taskId) {
    return runs.get(typeof taskId === 'string' ? taskId.trim() : '') || null;
  }

  function activeCount() {
    let active = 0;
    for (const run of runs.values()) if (run.state === ACTIVE_STATE) active += 1;
    return active;
  }

  function settle(run, state, reason) {
    run.state = state;
    run.reason = reason;
    run.finishedAt = now().toISOString();
    run.inbox.length = 0;
    if (!run.controller.signal.aborted) run.controller.abort(state === 'cancelled' ? reason : 'AGENT_RUN_FINISHED');
    return view(run);
  }

  /** Yeni bir alt koşu açar; eşzamanlılık bütçesi dolduysa açılmaz. */
  function start(descriptor) {
    const { taskId, agentId } = strictRun(descriptor);
    if (stopped) fail('AGENT_LIFECYCLE_STOPPED');
    if (runs.has(taskId)) fail('AGENT_RUN_DUPLICATE');
    if (runs.size >= MAX_RUNS) fail('AGENT_RUN_LIMIT_EXCEEDED');
    if (activeCount() >= concurrencyLimit) fail('AGENT_CONCURRENCY_EXCEEDED');

    const run = {
      taskId,
      agentId,
      state: ACTIVE_STATE,
      reason: null,
      startedAt: now().toISOString(),
      finishedAt: null,
      inbox: [],
      controller: new AbortController()
    };
    runs.set(taskId, run);
    return Object.freeze({ ...view(run), signal: run.controller.signal });
  }

  /** Çalışan koşuyu iptal eder; tamamlanmış koşu geriye alınamaz. */
  function cancel(taskId, reason) {
    const run = lookup(taskId);
    if (!run) return failed('AGENT_RUN_NOT_FOUND');
    if (FINAL_STATES.has(run.state)) return failed('AGENT_RUN_ALREADY_FINISHED');
    return { ok: true, run: settle(run, 'cancelled', safeReason(reason, 'AGENT_RUN_CANCELLED')) };
  }

  /** Üst istek düştüğünde tüm canlı alt koşuları tek seferde kapatır. */
  function cancelAll(reason) {
    const safe = safeReason(reason, 'AGENT_RUN_CANCELLED');
    stopped = true;
    stoppedReason = safe;
    let cancelled = 0;
    for (const run of runs.values()) {
      if (FINAL_STATES.has(run.state)) continue;
      settle(run, 'cancelled', safe);
      cancelled += 1;
    }
    return cancelled;
  }

  if (parentSignal) {
    if (parentSignal.aborted) cancelAll('PARENT_ABORTED');
    else parentSignal.addEventListener('abort', () => cancelAll('PARENT_ABORTED'), { once: true });
  }

  /**
   * Koşuyu kapatır. İptal edilmiş koşunun sonucu kabul edilmez; çağıran
   * taraf yarışı kazansa bile iptal kararı korunur.
   */
  function finish(taskId, { ok = true, error = null } = {}) {
    const run = lookup(taskId);
    if (!run) return failed('AGENT_RUN_NOT_FOUND');
    if (run.state === 'cancelled') return failed('AGENT_RUN_CANCELLED');
    if (FINAL_STATES.has(run.state)) return failed('AGENT_RUN_ALREADY_FINISHED');
    return ok
      ? { ok: true, run: settle(run, 'completed', null) }
      : { ok: true, run: settle(run, 'failed', safeReason(error, 'AGENT_RUN_FAILED')) };
  }

  /** Mesaj yalnızca hâlâ çalışan koşuya ve sınırlı kuyruğa teslim edilir. */
  function deliverMessage(taskId, message) {
    const run = lookup(taskId);
    if (!run) return failed('AGENT_RUN_NOT_FOUND');
    if (run.state !== ACTIVE_STATE) return failed('AGENT_RUN_NOT_ACCEPTING_MESSAGES');
    const text = typeof message === 'string' ? message.trim() : '';
    if (!text || text.length > MAX_MESSAGE_LENGTH) return failed('INVALID_AGENT_MESSAGE');
    if (run.inbox.length >= MAX_INBOX) return failed('AGENT_INBOX_FULL');
    run.inbox.push({ text, receivedAt: now().toISOString() });
    return { ok: true, pendingMessages: run.inbox.length };
  }

  /** Bekleyen mesajları yalnızca canlı koşu için teslim eder ve kuyruğu boşaltır. */
  function drainMessages(taskId) {
    const run = lookup(taskId);
    if (!run || run.state !== ACTIVE_STATE) return [];
    return run.inbox.splice(0, run.inbox.length).map((entry) => Object.freeze({ ...entry }));
  }

  function read(taskId) {
    const run = lookup(taskId);
    return run ? view(run) : null;
  }

  return Object.freeze({
    concurrencyLimit,
    start,
    cancel,
    cancelAll,
    finish,
    deliverMessage,
    drainMessages,
    read,
    isCancelled: (taskId) => read(taskId)?.state === 'cancelled',
    get stopped() {
      return stopped;
    },
    get activeCount() {
      return activeCount();
    },
    snapshot() {
      return Object.freeze({ concurrencyLimit, stopped, stoppedReason, runs: Object.freeze([...runs.values()].map(view)) });
    }
  });
}
