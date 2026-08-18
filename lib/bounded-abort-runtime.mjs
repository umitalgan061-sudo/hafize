function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function validSignal(signal) {
  return signal == null || (
    typeof signal === 'object'
    && typeof signal.aborted === 'boolean'
    && typeof signal.addEventListener === 'function'
    && typeof signal.removeEventListener === 'function'
  );
}

function normalizeTimeoutMs(value, { min = 1, max = 300_000 } = {}) {
  if (!Number.isInteger(value) || value < min || value > max) {
    fail('INVALID_BOUNDED_ABORT_TIMEOUT');
  }
  return value;
}

function abortWithReason(controller, reason) {
  if (controller.signal.aborted) return false;
  try {
    controller.abort(reason);
  } catch {
    controller.abort();
  }
  return true;
}

export function createBoundedAbortRuntime({ signal = null, timeoutMs } = {}) {
  if (!validSignal(signal)) fail('INVALID_BOUNDED_ABORT_SIGNAL');
  const timeout = normalizeTimeoutMs(timeoutMs);
  const controller = new AbortController();
  let disposed = false;
  let timedOut = false;

  const onCallerAbort = () => {
    abortWithReason(controller, signal?.reason);
  };

  if (signal?.aborted) onCallerAbort();
  else signal?.addEventListener('abort', onCallerAbort, { once: true });

  const timer = setTimeout(() => {
    timedOut = true;
    const error = new Error('BOUNDED_ABORT_TIMEOUT');
    error.code = 'BOUNDED_ABORT_TIMEOUT';
    abortWithReason(controller, error);
  }, timeout);
  timer.unref?.();

  function dispose() {
    if (disposed) return false;
    disposed = true;
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onCallerAbort);
    return true;
  }

  return Object.freeze({
    signal: controller.signal,
    dispose,
    isTimedOut: () => timedOut,
    isDisposed: () => disposed
  });
}

export async function runWithBoundedAbort(operation, { signal = null, timeoutMs } = {}) {
  if (typeof operation !== 'function') fail('INVALID_BOUNDED_ABORT_OPERATION');
  const runtime = createBoundedAbortRuntime({ signal, timeoutMs });
  try {
    return await operation(runtime.signal);
  } finally {
    runtime.dispose();
  }
}

export { abortWithReason, normalizeTimeoutMs, validSignal };
