import { createBoundedAbortRuntime } from './bounded-abort-runtime.mjs';

const DEFAULT_STREAM_TIMEOUT_MS = 300_000;
const MAX_STREAM_TIMEOUT_MS = 600_000;

function fail(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  throw error;
}

function makeError(code, status) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function cancellationReason() {
  return makeError('LOCAL_PROVIDER_CANCELLED', 499);
}

function normalizeTimeout(value) {
  if (value === undefined) return DEFAULT_STREAM_TIMEOUT_MS;
  if (!Number.isSafeInteger(value) || value < 1_000 || value > MAX_STREAM_TIMEOUT_MS) {
    fail('INVALID_LOCAL_PROVIDER_STREAM_TIMEOUT');
  }
  return value;
}

function mapAbort(error, runtime, callerSignal) {
  if (runtime.isTimedOut()) fail('LOCAL_PROVIDER_STREAM_TIMEOUT', 504);
  if (callerSignal?.aborted || error?.name === 'AbortError') fail('LOCAL_PROVIDER_CANCELLED', 499);
  throw error;
}

function wrapStream(body, runtime, callerSignal) {
  if (!body || typeof body[Symbol.asyncIterator] !== 'function') {
    const error = makeError('INVALID_LOCAL_PROVIDER_STREAM', 502);
    runtime.abort(error);
    runtime.dispose();
    throw error;
  }
  return Object.freeze({
    async *[Symbol.asyncIterator]() {
      let completed = false;
      try {
        for await (const chunk of body) yield chunk;
        completed = true;
      } catch (error) {
        if (runtime.isTimedOut() || callerSignal?.aborted || error?.name === 'AbortError') {
          mapAbort(error, runtime, callerSignal);
        }
        runtime.abort(error);
        throw error;
      } finally {
        if (!completed && !runtime.signal.aborted) runtime.abort(cancellationReason());
        runtime.dispose();
      }
    }
  });
}

export function createLocalProviderStreamDeadline(streamFn, { timeoutMs } = {}) {
  if (typeof streamFn !== 'function') fail('INVALID_LOCAL_PROVIDER_STREAM_FUNCTION');
  const safeTimeoutMs = normalizeTimeout(timeoutMs);

  return async function streamWithDeadline(payload, { signal } = {}) {
    const runtime = createBoundedAbortRuntime({ signal, timeoutMs: safeTimeoutMs });
    try {
      const body = await streamFn(payload, { signal: runtime.signal });
      return wrapStream(body, runtime, signal);
    } catch (error) {
      try {
        if (runtime.isTimedOut() || signal?.aborted || error?.name === 'AbortError') mapAbort(error, runtime, signal);
        throw error;
      } finally {
        runtime.dispose();
      }
    }
  };
}

export const LOCAL_PROVIDER_STREAM_DEFAULTS = Object.freeze({
  timeoutMs: DEFAULT_STREAM_TIMEOUT_MS,
  maxTimeoutMs: MAX_STREAM_TIMEOUT_MS
});
