const DEFAULT_MAX_CONCURRENT = 2;
const MAX_CONCURRENT = 16;
const DEFAULT_RETRY_AFTER_SECONDS = 1;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function boundedInteger(value, fallback, min, max, label) {
  const candidate = value == null ? fallback : value;
  if (!Number.isSafeInteger(candidate) || candidate < min || candidate > max) {
    fail(`INVALID_CLOUD_SESSION_LOGIN_CONCURRENCY:${label}`);
  }
  return candidate;
}

export function createCloudSessionLoginConcurrencyGate({
  maxConcurrent = DEFAULT_MAX_CONCURRENT,
  retryAfterSeconds = DEFAULT_RETRY_AFTER_SECONDS
} = {}) {
  const limit = boundedInteger(maxConcurrent, DEFAULT_MAX_CONCURRENT, 1, MAX_CONCURRENT, 'maxConcurrent');
  const retryAfter = boundedInteger(retryAfterSeconds, DEFAULT_RETRY_AFTER_SECONDS, 1, 60, 'retryAfterSeconds');
  let active = 0;

  function begin() {
    if (active >= limit) {
      return Object.freeze({
        ok: false,
        status: 503,
        error: 'SESSION_AUTH_BUSY',
        retryAfterSeconds: retryAfter
      });
    }

    active += 1;
    let completed = false;
    return Object.freeze({
      ok: true,
      complete() {
        if (completed) return false;
        completed = true;
        active = Math.max(0, active - 1);
        return true;
      }
    });
  }

  return Object.freeze({
    begin,
    capacity: limit,
    activeCount: () => active
  });
}

export const CLOUD_SESSION_LOGIN_CONCURRENCY_LIMITS = Object.freeze({
  defaultMaxConcurrent: DEFAULT_MAX_CONCURRENT,
  maxConcurrent: MAX_CONCURRENT,
  defaultRetryAfterSeconds: DEFAULT_RETRY_AFTER_SECONDS
});
