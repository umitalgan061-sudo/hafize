const STATES = Object.freeze({ running: 'running', completed: 'completed', failed: 'failed', cancelled: 'cancelled' });
const TERMINAL = new Set([STATES.completed, STATES.failed, STATES.cancelled]);
const DEFAULT_MAX_CONCURRENT = 2;
const MAX_MAX_CONCURRENT = 8;
const DEFAULT_INBOX_LIMIT = 32;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function cleanText(value, max, code) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max || text.includes('\0')) fail(code);
  return text;
}

function normalizeMaxConcurrent(value) {
  const result = value === undefined ? DEFAULT_MAX_CONCURRENT : value;
  if (!Number.isInteger(result) || result < 1 || result > MAX_MAX_CONCURRENT) fail('INVALID_AGENT_CONCURRENCY_LIMIT');
  return result;
}

function normalizeInboxLimit(value) {
  const result = value === undefined ? DEFAULT_INBOX_LIMIT : value;
  if (!Number.isInteger(result) || result < 1 || result > 256) fail('INVALID_AGENT_INBOX_LIMIT');
  return result;
}

export function createAgentLifecycle({ maxConcurrent = DEFAULT_MAX_CONCURRENT, inboxLimit = DEFAULT_INBOX_LIMIT } = {}) {
  const concurrentLimit = normalizeMaxConcurrent(maxConcurrent);
  const queueLimit = normalizeInboxLimit(inboxLimit);
  const runs = new Map();

  function liveCount() {
    let count = 0;
    for (const run of runs.values()) if (run.state === STATES.running) count += 1;
    return count;
  }

  function snapshot(run) {
    return Object.freeze({
      runId: run.runId, state: run.state, startedAt: run.startedAt, finishedAt: run.finishedAt,
      parentRunId: run.parentRunId, messages: run.messages.length, acceptedMessages: run.acceptedMessages,
      rejectedMessages: run.rejectedMessages, error: run.error
    });
  }

  function start({ runId, parentRunId = '', parentSignal, execute } = {}) {
    const id = cleanText(runId, 120, 'INVALID_AGENT_RUN_ID');
    if (runs.has(id)) fail('AGENT_RUN_ALREADY_EXISTS');
    if (typeof execute !== 'function') fail('INVALID_AGENT_EXECUTOR');
    if (liveCount() >= concurrentLimit) fail('AGENT_CONCURRENCY_EXCEEDED');
    const controller = new AbortController();
    const run = {
      runId: id,
      parentRunId: typeof parentRunId === 'string' ? parentRunId.slice(0, 120) : '',
      state: STATES.running,
      startedAt: Date.now(),
      finishedAt: null,
      messages: [],
      acceptedMessages: 0,
      rejectedMessages: 0,
      error: null,
      controller,
      detachParent: null
    };
    runs.set(id, run);

    if (parentSignal) {
      if (typeof parentSignal.addEventListener !== 'function') fail('INVALID_PARENT_SIGNAL');
      const abort = () => cancel(id, 'PARENT_ABORTED');
      if (parentSignal.aborted) abort();
      else {
        parentSignal.addEventListener('abort', abort, { once: true });
        run.detachParent = () => parentSignal.removeEventListener('abort', abort);
      }
    }

    // The run starts eagerly: `execute` is entered before `start` returns, so a
    // caller that already holds the handle can observe the work in flight and a
    // run cancelled in the same tick never enters its body at all.
    const settle = (error) => {
      if (runs.get(id)?.state === STATES.cancelled) return finish(id, STATES.cancelled, runs.get(id).error, undefined);
      return finish(id, STATES.failed, sanitizeError(error), undefined);
    };
    let promise;
    if (run.state === STATES.cancelled) {
      promise = Promise.resolve(Object.freeze({ value: undefined, snapshot: snapshot(run) }));
    } else {
      try {
        promise = Promise.resolve(execute({ runId: id, signal: controller.signal }))
          .then((value) => finish(id, STATES.completed, null, value))
          .catch(settle);
      } catch (error) {
        promise = Promise.resolve(settle(error));
      }
    }
    return Object.freeze({ runId: id, signal: controller.signal, promise, snapshot: () => snapshot(run), cancel: (reason) => cancel(id, reason) });
  }

  function sanitizeError(error) {
    const code = typeof error?.code === 'string' ? error.code : 'AGENT_RUN_FAILED';
    return code.slice(0, 120);
  }

  function finish(runId, state, error = null, value) {
    const run = runs.get(runId);
    if (!run || TERMINAL.has(run.state)) return undefined;
    if (!TERMINAL.has(state)) fail('INVALID_AGENT_TERMINAL_STATE');
    run.state = state;
    run.error = typeof error === 'string' ? error : null;
    run.finishedAt = Date.now();
    run.controller.abort();
    run.detachParent?.();
    return Object.freeze({ value, snapshot: snapshot(run) });
  }

  function cancel(runId, reason = 'AGENT_CANCELLED') {
    const run = runs.get(runId);
    if (!run) return false;
    if (TERMINAL.has(run.state)) return false;
    run.state = STATES.cancelled;
    run.error = cleanText(String(reason || 'AGENT_CANCELLED'), 120, 'INVALID_CANCEL_REASON');
    run.finishedAt = Date.now();
    run.controller.abort();
    run.detachParent?.();
    return true;
  }

  function sendMessage(runId, message) {
    const run = runs.get(runId);
    if (!run || run.state !== STATES.running) {
      if (run) run.rejectedMessages += 1;
      fail('AGENT_RUN_NOT_ACCEPTING_MESSAGES');
    }
    if (run.messages.length >= queueLimit) {
      run.rejectedMessages += 1;
      fail('AGENT_INBOX_FULL');
    }
    const text = cleanText(message, 8_000, 'INVALID_AGENT_MESSAGE');
    const item = Object.freeze({ id: `${run.runId}:${run.messages.length + 1}`, content: text, receivedAt: Date.now() });
    run.messages.push(item);
    run.acceptedMessages += 1;
    return item;
  }

  function get(runId) {
    const run = runs.get(typeof runId === 'string' ? runId : '');
    return run ? snapshot(run) : null;
  }

  function list() {
    return Object.freeze([...runs.values()].map(snapshot));
  }

  return Object.freeze({ start, cancel, sendMessage, get, list, liveCount: () => liveCount(), limits: Object.freeze({ maxConcurrent: concurrentLimit, inboxLimit: queueLimit }), states: STATES });
}
