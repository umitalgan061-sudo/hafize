import { createBoundedAbortRuntime } from './bounded-abort-runtime.mjs';

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

function normalizeTimeoutMs(value) {
  if (!Number.isInteger(value) || value < 10_000 || value > 300_000) {
    fail('INVALID_SCHEDULE_NVIDIA_TIMEOUT');
  }
  return value;
}

function publicError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function createScheduledNvidiaCompletion({
  complete,
  timeoutMs,
  createAbortRuntime = createBoundedAbortRuntime
} = {}) {
  if (typeof complete !== 'function') fail('INVALID_SCHEDULE_NVIDIA_COMPLETE');
  if (typeof createAbortRuntime !== 'function') fail('INVALID_SCHEDULE_NVIDIA_ABORT_FACTORY');
  const boundedTimeoutMs = normalizeTimeoutMs(timeoutMs);

  return async function scheduledNvidiaCompletion(payload, signal = null) {
    if (!validSignal(signal)) fail('INVALID_SCHEDULE_NVIDIA_SIGNAL');
    if (signal?.aborted) throw publicError('SCHEDULE_AGENT_RUN_CANCELLED');

    const runtime = createAbortRuntime({ signal, timeoutMs: boundedTimeoutMs });
    if (!runtime || !validSignal(runtime.signal) || typeof runtime.dispose !== 'function' || typeof runtime.isTimedOut !== 'function') {
      fail('INVALID_SCHEDULE_NVIDIA_ABORT_RUNTIME');
    }

    try {
      return await complete(payload, runtime.signal);
    } catch (error) {
      if (signal?.aborted) throw publicError('SCHEDULE_AGENT_RUN_CANCELLED');
      if (runtime.isTimedOut()) throw publicError('SCHEDULE_AGENT_RUN_TIMEOUT');
      throw error;
    } finally {
      runtime.dispose();
    }
  };
}

export { normalizeTimeoutMs, validSignal };
