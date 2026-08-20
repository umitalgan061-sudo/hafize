import assert from 'node:assert/strict';
import {
  normalizeScheduleExecutionResult,
  SCHEDULE_EXECUTION_RESULT_INVALID,
  SCHEDULE_EXECUTION_RESULT_POLICY
} from '../lib/schedule-execution-result-policy.mjs';

function invalid(value, label) {
  const result = normalizeScheduleExecutionResult(value);
  assert.deepEqual(result, {
    ok: false,
    error: SCHEDULE_EXECUTION_RESULT_INVALID,
    contractInvalid: true
  }, label);
  assert.equal(Object.isFrozen(result), true, `${label}: result frozen`);
}

const success = normalizeScheduleExecutionResult({ ok: true });
assert.deepEqual(success, { ok: true });
assert.equal(Object.isFrozen(success), true);

const failure = normalizeScheduleExecutionResult({ ok: false, error: 'TEMPORARY_FAILURE' });
assert.deepEqual(failure, { ok: false, error: 'TEMPORARY_FAILURE' });
assert.equal(Object.isFrozen(failure), true);

const retry = normalizeScheduleExecutionResult({
  ok: false,
  error: 'SCHEDULE_LEASE_BUSY',
  retryAt: '2026-08-20T20:00:00+03:00'
});
assert.deepEqual(retry, {
  ok: false,
  error: 'SCHEDULE_LEASE_BUSY',
  retryAt: '2026-08-20T17:00:00.000Z'
});

const nullPrototype = Object.create(null);
nullPrototype.ok = false;
nullPrototype.error = 'NULL_PROTO_FAILURE';
assert.deepEqual(normalizeScheduleExecutionResult(nullPrototype), {
  ok: false,
  error: 'NULL_PROTO_FAILURE'
});

invalid(null, 'null');
invalid(undefined, 'undefined');
invalid(true, 'boolean');
invalid('ok', 'string');
invalid([], 'array');
invalid(new Date(), 'date');
invalid(new Map(), 'map');
invalid(Object.create({ ok: true }), 'custom prototype');
invalid({}, 'missing ok');
invalid({ ok: 1 }, 'numeric ok');
invalid({ ok: 'true' }, 'string ok');
invalid({ ok: true, error: 'SHOULD_NOT_EXIST' }, 'success with error');
invalid({ ok: true, retryAt: '2026-08-20T17:00:00.000Z' }, 'success with retry');
invalid({ ok: true, extra: true }, 'success with extra key');
invalid({ ok: false }, 'failure missing error');
invalid({ ok: false, error: '' }, 'empty error');
invalid({ ok: false, error: ' lower' }, 'leading whitespace');
invalid({ ok: false, error: 'LOWER_case' }, 'lowercase error');
invalid({ ok: false, error: 'HAS SPACE' }, 'space in error');
invalid({ ok: false, error: 'X'.repeat(121) }, 'oversized error');
invalid({ ok: false, error: 'SCHEDULE_EXECUTION_STATE_UNCERTAIN' }, 'reserved uncertain error');
invalid({ ok: false, error: 'FAIL', retryAt: '' }, 'empty retryAt');
invalid({ ok: false, error: 'FAIL', retryAt: 'not-a-date' }, 'invalid retryAt');
invalid({ ok: false, error: 'FAIL', retryAt: ' '.repeat(65) }, 'oversized retryAt');
invalid({ ok: false, error: 'FAIL', retryAt: 123 }, 'numeric retryAt');
invalid({ ok: false, error: 'FAIL', extra: 'value' }, 'failure with extra key');

const getterResult = { ok: false };
Object.defineProperty(getterResult, 'error', {
  enumerable: true,
  get() {
    throw new Error('getter must never execute');
  }
});
invalid(getterResult, 'getter property rejected without execution');

const setterResult = { ok: false, error: 'FAIL' };
Object.defineProperty(setterResult, 'retryAt', {
  enumerable: true,
  configurable: true,
  set(_value) {}
});
invalid(setterResult, 'setter property rejected');

const symbolResult = { ok: true };
symbolResult[Symbol('hidden')] = 'ignored';
assert.deepEqual(normalizeScheduleExecutionResult(symbolResult), { ok: true });

assert.equal(SCHEDULE_EXECUTION_RESULT_POLICY.maxErrorChars, 120);
assert.equal(SCHEDULE_EXECUTION_RESULT_POLICY.maxRetryAtChars, 64);
assert.deepEqual(
  SCHEDULE_EXECUTION_RESULT_POLICY.reservedWorkerErrors,
  ['SCHEDULE_EXECUTION_STATE_UNCERTAIN']
);
assert.equal(Object.isFrozen(SCHEDULE_EXECUTION_RESULT_POLICY), true);
assert.equal(Object.isFrozen(SCHEDULE_EXECUTION_RESULT_POLICY.reservedWorkerErrors), true);

for (const error of [
  'A',
  'SCHEDULE_LEASE_BUSY',
  'SCHEDULE_LEASE_LOST',
  'SCHEDULE_EXECUTION_CANCELLED',
  'PROVIDER:TIMEOUT',
  'X'.repeat(120)
]) {
  const normalized = normalizeScheduleExecutionResult({ ok: false, error });
  assert.equal(normalized.error, error);
  assert.equal(normalized.contractInvalid, undefined);
}

console.log('schedule execution result policy tests passed');
