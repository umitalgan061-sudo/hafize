const MAX_EXECUTION_ERROR_CHARS = 120;
const MAX_RETRY_AT_CHARS = 64;

export const SCHEDULE_EXECUTION_RESULT_INVALID = 'SCHEDULE_EXECUTION_RESULT_INVALID';

const RESERVED_WORKER_ERRORS = new Set([
  'SCHEDULE_EXECUTION_STATE_UNCERTAIN'
]);

const ALLOWED_SUCCESS_KEYS = new Set(['ok']);
const ALLOWED_FAILURE_KEYS = new Set(['ok', 'error', 'retryAt']);
const ERROR_PATTERN = /^[A-Z0-9_:-]{1,120}$/;

function isPlainRecord(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyDataProperties(value) {
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return Object.values(descriptors).every((descriptor) =>
    Object.prototype.hasOwnProperty.call(descriptor, 'value')
    && typeof descriptor.get !== 'function'
    && typeof descriptor.set !== 'function'
  );
}

function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.has(key));
}

function normalizeError(value) {
  if (typeof value !== 'string') return null;
  const error = value.trim();
  if (error !== value || error.length < 1 || error.length > MAX_EXECUTION_ERROR_CHARS) return null;
  if (!ERROR_PATTERN.test(error) || RESERVED_WORKER_ERRORS.has(error)) return null;
  return error;
}

function normalizeRetryAt(value) {
  if (value == null) return null;
  if (typeof value !== 'string' || value.length < 1 || value.length > MAX_RETRY_AT_CHARS || value.trim() !== value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export function normalizeScheduleExecutionResult(value) {
  if (!isPlainRecord(value) || !hasOnlyDataProperties(value) || typeof value.ok !== 'boolean') {
    return Object.freeze({ ok: false, error: SCHEDULE_EXECUTION_RESULT_INVALID, contractInvalid: true });
  }

  if (value.ok === true) {
    if (!hasOnlyKeys(value, ALLOWED_SUCCESS_KEYS)) {
      return Object.freeze({ ok: false, error: SCHEDULE_EXECUTION_RESULT_INVALID, contractInvalid: true });
    }
    return Object.freeze({ ok: true });
  }

  if (!hasOnlyKeys(value, ALLOWED_FAILURE_KEYS)) {
    return Object.freeze({ ok: false, error: SCHEDULE_EXECUTION_RESULT_INVALID, contractInvalid: true });
  }

  const error = normalizeError(value.error);
  if (!error) {
    return Object.freeze({ ok: false, error: SCHEDULE_EXECUTION_RESULT_INVALID, contractInvalid: true });
  }

  const retryAt = normalizeRetryAt(value.retryAt);
  if (retryAt === undefined) {
    return Object.freeze({ ok: false, error: SCHEDULE_EXECUTION_RESULT_INVALID, contractInvalid: true });
  }

  return Object.freeze({
    ok: false,
    error,
    ...(retryAt ? { retryAt } : {})
  });
}

export const SCHEDULE_EXECUTION_RESULT_POLICY = Object.freeze({
  maxErrorChars: MAX_EXECUTION_ERROR_CHARS,
  maxRetryAtChars: MAX_RETRY_AT_CHARS,
  reservedWorkerErrors: Object.freeze([...RESERVED_WORKER_ERRORS])
});
