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

function cancellationCode(signal, runtime) {
  if (signal?.aborted) return 'SCHEDULE_AGENT_RUN_CANCELLED';
  if (runtime?.isTimedOut?.()) return 'SCHEDULE_AGENT_RUN_TIMEOUT';
  if (runtime?.signal?.aborted) return 'SCHEDULE_AGENT_RUN_CANCELLED';
  return null;
}

export function createScheduledNvidiaCompletion({
  complete,
  timeoutMs,
  createAbortRuntime = createBoundedAbortRuntime
} = {}) {
  if (typeof complete !== 'function') fail('INVALID_SCHEDULE_NVIDIA_COMPLETE');
  if (typeof createAbortRuntime !== 'function') fail('INVALID_SCHEDULE_NVIDIA_ABORT_FACTORY');
  const boundedTimeoutMs = normalizeTimeoutMs(timeoutMs);

  const scheduledNvidiaCompletion = async (payload, signal = null) => {
    if (!validSignal(signal)) fail('INVALID_SCHEDULE_NVIDIA_SIGNAL');
    if (signal?.aborted) throw publicError('SCHEDULE_AGENT_RUN_CANCELLED');

    const runtime = createAbortRuntime({ signal, timeoutMs: boundedTimeoutMs });
    if (!runtime || !validSignal(runtime.signal) || typeof runtime.dispose !== 'function' || typeof runtime.isTimedOut !== 'function') {
      fail('INVALID_SCHEDULE_NVIDIA_ABORT_RUNTIME');
    }

    try {
      const beforeStart = cancellationCode(signal, runtime);
      if (beforeStart) throw publicError(beforeStart);
      return await complete(payload, runtime.signal);
    } catch (error) {
      const code = cancellationCode(signal, runtime);
      if (code) throw publicError(code);
      throw error;
    } finally {
      runtime.dispose();
    }
  };

  Object.defineProperty(scheduledNvidiaCompletion, 'timeoutMs', {
    value: boundedTimeoutMs,
    enumerable: true,
    writable: false,
    configurable: false
  });
  return scheduledNvidiaCompletion;
}

export { cancellationCode, normalizeTimeoutMs, validSignal };
