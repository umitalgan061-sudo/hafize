const ERROR_PATTERN = /^[A-Z0-9_:-]{1,120}$/;
const MAX_RESULT_MESSAGE = 2_000;
const TERMINAL_STATUSES = new Set(['completed', 'failed']);

function cleanError(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return ERROR_PATTERN.test(text) ? text : 'SCHEDULE_EXECUTION_FAILED';
}

function cleanMessage(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.slice(0, MAX_RESULT_MESSAGE);
}

export function normalizeScheduleExecutionResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return Object.freeze({ ok: false, error: 'SCHEDULE_EXECUTION_FAILED', message: '' });
  }
  if (result.ok === true) return Object.freeze({ ok: true, message: cleanMessage(result.message), traceId: cleanMessage(result.traceId) });
  return Object.freeze({ ok: false, error: cleanError(result.error), message: cleanMessage(result.message), retryAt: cleanMessage(result.retryAt) });
}

export function classifyScheduleOutcome(result, schedule) {
  const normalized = normalizeScheduleExecutionResult(result);
  if (normalized.ok) return Object.freeze({ ...normalized, status: 'completed', retry: false });
  if (normalized.error === 'SCHEDULE_LEASE_BUSY') return Object.freeze({ ...normalized, status: 'deferred', retry: true, attemptRefunded: true });
  const attempts = Number.isInteger(schedule?.attempts) ? Math.max(schedule.attempts, 0) : 0;
  const maxAttempts = Number.isInteger(schedule?.maxAttempts) ? Math.max(schedule.maxAttempts, 1) : 1;
  const retry = attempts < maxAttempts;
  return Object.freeze({ ...normalized, status: retry ? 'retrying' : 'failed', retry, attemptRefunded: false });
}

export function validateScheduleLifecycle(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('INVALID_SCHEDULE_LIFECYCLE');
  const status = typeof snapshot.status === 'string' ? snapshot.status.trim() : '';
  if (!TERMINAL_STATUSES.has(status) && !['pending', 'running', 'deferred'].includes(status)) throw new Error('INVALID_SCHEDULE_LIFECYCLE_STATUS');
  if (status === 'completed' && snapshot.lastError) throw new Error('INVALID_SCHEDULE_COMPLETED_ERROR');
  if (status === 'running' && snapshot.completedAt) throw new Error('INVALID_SCHEDULE_RUNNING_COMPLETED_AT');
  if (snapshot.attempts != null && (!Number.isInteger(snapshot.attempts) || snapshot.attempts < 0)) throw new Error('INVALID_SCHEDULE_ATTEMPTS');
  if (snapshot.maxAttempts != null && (!Number.isInteger(snapshot.maxAttempts) || snapshot.maxAttempts < 1)) throw new Error('INVALID_SCHEDULE_MAX_ATTEMPTS');
  return Object.freeze({ status, valid: true });
}

export const SCHEDULE_RELIABILITY_LIMITS = Object.freeze({
  maxResultMessage: MAX_RESULT_MESSAGE,
  terminalStatuses: Object.freeze([...TERMINAL_STATUSES])
});
