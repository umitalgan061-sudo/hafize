import assert from 'node:assert/strict';
import {
  classifyScheduleOutcome,
  normalizeScheduleExecutionResult,
  validateScheduleLifecycle,
  SCHEDULE_RELIABILITY_LIMITS
} from '../lib/schedule-reliability.mjs';

assert.deepEqual(normalizeScheduleExecutionResult({ ok: true, message: ' tamam ', traceId: 'trace-1' }), { ok: true, message: 'tamam', traceId: 'trace-1' });
assert.deepEqual(normalizeScheduleExecutionResult({ ok: false, error: 'SCHEDULE_LEASE_BUSY', retryAt: '2026-09-07T12:01:00.000Z' }), { ok: false, error: 'SCHEDULE_LEASE_BUSY', message: '', retryAt: '2026-09-07T12:01:00.000Z' });
assert.equal(normalizeScheduleExecutionResult(null).error, 'SCHEDULE_EXECUTION_FAILED');
assert.equal(normalizeScheduleExecutionResult({ ok: false, error: 'bad error!' }).error, 'SCHEDULE_EXECUTION_FAILED');

const busy = classifyScheduleOutcome({ ok: false, error: 'SCHEDULE_LEASE_BUSY' }, { attempts: 3, maxAttempts: 3 });
assert.equal(busy.status, 'deferred');
assert.equal(busy.retry, true);
assert.equal(busy.attemptRefunded, true);
const retrying = classifyScheduleOutcome({ ok: false, error: 'UPSTREAM_TIMEOUT' }, { attempts: 1, maxAttempts: 3 });
assert.equal(retrying.status, 'retrying');
assert.equal(retrying.retry, true);
const terminal = classifyScheduleOutcome({ ok: false, error: 'UPSTREAM_TIMEOUT' }, { attempts: 3, maxAttempts: 3 });
assert.equal(terminal.status, 'failed');
assert.equal(terminal.retry, false);
assert.equal(classifyScheduleOutcome({ ok: true }, { attempts: 10, maxAttempts: 1 }).status, 'completed');

assert.equal(validateScheduleLifecycle({ status: 'pending', attempts: 0, maxAttempts: 3 }).valid, true);
assert.equal(validateScheduleLifecycle({ status: 'running', attempts: 1, maxAttempts: 3 }).valid, true);
assert.throws(() => validateScheduleLifecycle({ status: 'completed', lastError: 'UPSTREAM_TIMEOUT' }), /INVALID_SCHEDULE_COMPLETED_ERROR/);
assert.throws(() => validateScheduleLifecycle({ status: 'running', completedAt: 'x' }), /INVALID_SCHEDULE_RUNNING_COMPLETED_AT/);
assert.throws(() => validateScheduleLifecycle({ status: 'wat' }), /INVALID_SCHEDULE_LIFECYCLE_STATUS/);
assert.equal(SCHEDULE_RELIABILITY_LIMITS.maxResultMessage, 2_000);

console.log('schedule reliability tests passed');
