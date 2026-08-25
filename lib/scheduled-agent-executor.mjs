import { createAgentRunLedger } from './agent-run-ledger.mjs';
import { createBoundedAbortRuntime, normalizeTimeoutMs } from './bounded-abort-runtime.mjs';
import { runDelegatedAgent } from './delegated-agent-runner.mjs';
import { containsPlaintextCredential } from './plaintext-credential-policy.mjs';

function cleanText(value, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && text.length <= maxLength ? text : null;
}

function cleanErrorCode(value) {
  const text = cleanText(value, 120);
  return text && /^[A-Z0-9_:-]+$/.test(text) ? text : 'SCHEDULE_AGENT_RUN_FAILED';
}

function validSignal(signal) {
  return signal == null || (
    typeof signal === 'object'
    && typeof signal.aborted === 'boolean'
    && typeof signal.addEventListener === 'function'
  );
}

function cancellationError() {
  const error = new Error('SCHEDULE_AGENT_RUN_CANCELLED');
  error.code = 'SCHEDULE_AGENT_RUN_CANCELLED';
  return error;
}

function settleWithSignal(start, signal) {
  if (typeof start !== 'function') return Promise.reject(new Error('INVALID_SCHEDULE_AGENT_RUN:start'));
  if (!signal) return Promise.resolve().then(start);
  if (signal.aborted) return Promise.reject(cancellationError());

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener?.('abort', onAbort);
      callback(value);
    };
    const onAbort = () => finish(reject, cancellationError());
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve()
      .then(() => {
        if (settled || signal.aborted) {
          onAbort();
          return undefined;
        }
        return start();
      })
      .then((value) => finish(resolve, value), (error) => finish(reject, error));
  });
}

function thrownRunError(error, signal, timedOut = false) {
  if (timedOut) return 'SCHEDULE_AGENT_RUN_TIMEOUT';
  if (signal?.aborted) return 'SCHEDULE_AGENT_RUN_CANCELLED';
  return error?.code === 'SCHEDULE_AGENT_RUN_TIMEOUT'
    ? 'SCHEDULE_AGENT_RUN_TIMEOUT'
    : 'SCHEDULE_AGENT_RUN_FAILED';
}

export function createScheduledAgentExecutor({
  registry,
  model,
  complete,
  maxTokens = 2048,
  runTimeoutMs = null,
  nvidiaConfigured = false,
  githubReadConfigured = false,
  githubReadFile,
  runAgentTask = runDelegatedAgent
} = {}) {
  if (!Array.isArray(registry?.agents)) throw new Error('INVALID_SCHEDULE_AGENT_EXECUTOR:registry');
  if (typeof complete !== 'function') throw new Error('INVALID_SCHEDULE_AGENT_EXECUTOR:complete');
  if (typeof runAgentTask !== 'function') throw new Error('INVALID_SCHEDULE_AGENT_EXECUTOR:runAgentTask');

  const safeModel = cleanText(model, 300);
  const tokenLimit = Number.isInteger(maxTokens) ? Math.min(Math.max(maxTokens, 1), 8192) : 2048;
  const timeoutPolicy = runTimeoutMs ?? complete.timeoutMs ?? 120_000;
  let runTimeout;
  try {
    runTimeout = normalizeTimeoutMs(timeoutPolicy);
  } catch {
    throw new Error('INVALID_SCHEDULE_AGENT_EXECUTOR:runTimeoutMs');
  }

  function completeWithSignal(payload, signal) {
    return settleWithSignal(() => complete(payload, signal), signal);
  }

  async function executeAgentTask({ traceId, agent, task, signal = null } = {}) {
    const safeTraceId = cleanText(traceId, 128);
    const safeTask = cleanText(task, 20000);
    const canonicalAgent = typeof agent?.id === 'string'
      ? registry.agents.find((item) => item?.id === agent.id) || null
      : null;
    if (!safeTraceId || !safeTask || !canonicalAgent || !validSignal(signal)) {
      return { ok: false, error: 'INVALID_SCHEDULE_AGENT_TASK' };
    }
    if (containsPlaintextCredential(safeTask)) {
      return { ok: false, error: 'SCHEDULE_AGENT_TASK_CREDENTIAL_BLOCKED' };
    }
    if (!safeModel) return { ok: false, error: 'SCHEDULE_MODEL_NOT_CONFIGURED' };
    if (signal?.aborted) return { ok: false, error: 'SCHEDULE_AGENT_RUN_CANCELLED' };

    const runLedger = createAgentRunLedger({
      traceId: safeTraceId,
      agentId: canonicalAgent.id,
      action: 'schedule.run'
    });
    const boundedRun = createBoundedAbortRuntime({ signal, timeoutMs: runTimeout });

    let result;
    try {
      result = await settleWithSignal(() => runAgentTask({
        agent: canonicalAgent,
        task: safeTask,
        traceId: safeTraceId,
        parentTaskId: runLedger.rootTaskId,
        depth: 0,
        signal: boundedRun.signal,
        registry,
        runLedger,
        model: safeModel,
        maxTokens: tokenLimit,
        complete: (payload, childSignal) => completeWithSignal(payload, childSignal || boundedRun.signal),
        nvidiaConfigured: Boolean(nvidiaConfigured),
        githubReadConfigured: Boolean(githubReadConfigured),
        githubReadFile
      }), boundedRun.signal);
      if (boundedRun.isTimedOut()) {
        result = { ok: false, error: 'SCHEDULE_AGENT_RUN_TIMEOUT' };
      }
    } catch (error) {
      result = { ok: false, error: thrownRunError(error, signal, boundedRun.isTimedOut()) };
    } finally {
      boundedRun.dispose();
    }

    if (!result?.ok) {
      const error = boundedRun.isTimedOut()
        ? 'SCHEDULE_AGENT_RUN_TIMEOUT'
        : signal?.aborted
          ? 'SCHEDULE_AGENT_RUN_CANCELLED'
          : cleanErrorCode(result?.error);
      if (error === 'SCHEDULE_AGENT_RUN_TIMEOUT' || error === 'SCHEDULE_AGENT_RUN_CANCELLED') {
        runLedger.failOpenEntries(error);
      }
      runLedger.finish({ ok: false, detail: error });
      return { ok: false, error, taskLedger: runLedger.snapshot() };
    }

    runLedger.finish({ ok: true });
    return {
      ok: true,
      content: typeof result.content === 'string' ? result.content : '',
      taskLedger: runLedger.snapshot()
    };
  }

  return Object.freeze({ configured: Boolean(safeModel), runTimeoutMs: runTimeout, executeAgentTask });
}

export { settleWithSignal, thrownRunError };
