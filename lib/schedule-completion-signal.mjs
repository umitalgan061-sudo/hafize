const DEFAULT_TIMEOUT_MS = 120_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 300_000;

function fail(label) {
  throw new Error(`INVALID_SCHEDULE_COMPLETION_SIGNAL:${label}`);
}

function validSignal(signal) {
  return signal == null || (
    typeof signal === 'object'
    && typeof signal.aborted === 'boolean'
    && typeof signal.addEventListener === 'function'
    && typeof signal.removeEventListener === 'function'
  );
}

function normalizeTimeoutMs(value = DEFAULT_TIMEOUT_MS) {
  if (!Number.isSafeInteger(value) || value < MIN_TIMEOUT_MS || value > MAX_TIMEOUT_MS) {
    fail('timeoutMs');
  }
  return value;
}

export function createScheduleCompletionSignal({ parentSignal = null, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!validSignal(parentSignal)) fail('parentSignal');
  const boundedTimeoutMs = normalizeTimeoutMs(timeoutMs);
  const controller = new AbortController();
  let cause = null;
  let disposed = false;

  const abort = (nextCause) => {
    if (controller.signal.aborted) return false;
    cause = nextCause;
    controller.abort(nextCause);
    return true;
  };
  const onParentAbort = () => abort('caller');

  if (parentSignal?.aborted) onParentAbort();
  else parentSignal?.addEventListener('abort', onParentAbort, { once: true });

  const timer = controller.signal.aborted
    ? null
    : setTimeout(() => abort('timeout'), boundedTimeoutMs);
  timer?.unref?.();

  function dispose() {
    if (disposed) return false;
    disposed = true;
    if (timer) clearTimeout(timer);
    parentSignal?.removeEventListener?.('abort', onParentAbort);
    return true;
  }

  return Object.freeze({
    signal: controller.signal,
    timeoutMs: boundedTimeoutMs,
    cause: () => cause,
    dispose
  });
}

export async function runWithScheduleCompletionSignal({
  parentSignal = null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  run
} = {}) {
  if (typeof run !== 'function') fail('run');
  const context = createScheduleCompletionSignal({ parentSignal, timeoutMs });
  try {
    return await run(context.signal, context);
  } finally {
    context.dispose();
  }
}

export const SCHEDULE_COMPLETION_SIGNAL_LIMITS = Object.freeze({
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
  minTimeoutMs: MIN_TIMEOUT_MS,
  maxTimeoutMs: MAX_TIMEOUT_MS
});

export { normalizeTimeoutMs, validSignal };
