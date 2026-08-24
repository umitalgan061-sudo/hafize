import assert from 'node:assert/strict';
import {
  TOOL_EXECUTION_RESULT_POLICY,
  createToolFailureFromError,
  createToolFailureResult,
  createToolSuccessResult,
  normalizeToolExecutionResult,
  normalizeToolValue
} from '../lib/tool-execution-result-policy.mjs';

assert.equal(TOOL_EXECUTION_RESULT_POLICY.maxJsonBytes, 384 * 1024);
assert.equal(TOOL_EXECUTION_RESULT_POLICY.maxDepth, 12);
assert.equal(TOOL_EXECUTION_RESULT_POLICY.maxNodes, 8192);

{
  const source = {
    status: 'ok',
    count: 3,
    enabled: true,
    nested: { values: ['a', 'b', null] }
  };
  const value = normalizeToolValue(source);
  assert.deepEqual(value, source);
  assert.notEqual(value, source);
  assert.notEqual(value.nested, source.nested);
  assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.isFrozen(value.nested), true);
  assert.equal(Object.isFrozen(value.nested.values), true);
  source.nested.values[0] = 'mutated';
  assert.equal(value.nested.values[0], 'a');
  assert.doesNotThrow(() => JSON.stringify(value));
}

{
  const shared = { label: 'shared' };
  const value = normalizeToolValue({ left: shared, right: shared });
  assert.deepEqual(value, { left: { label: 'shared' }, right: { label: 'shared' } });
  assert.notEqual(value.left, value.right, 'shared references become independent immutable snapshots');
}

{
  for (const value of [
    { message: 'Authorization: Bearer abcdefghijklmnop' },
    { nested: { value: 'github_pat_1234567890abcdefghijABCDEFGHIJ' } },
    { output: 'nvapi-1234567890abcdefghijklmnopqrstuv' },
    { access_token: 'opaque-value-without-provider-prefix' },
    { nested: { clientSecret: 'another-opaque-value' } }
  ]) {
    assert.deepEqual(
      createToolSuccessResult(value),
      { ok: false, error: 'TOOL_RESULT_PLAINTEXT_CREDENTIAL_BLOCKED' }
    );
  }
  assert.deepEqual(
    createToolSuccessResult({ token_count: 42, note: 'GitHub PAT güvenli biçimde secret manager içinde tutuluyor.' }),
    { ok: true, value: { token_count: 42, note: 'GitHub PAT güvenli biçimde secret manager içinde tutuluyor.' } }
  );
}

{
  const circular = { name: 'loop' };
  circular.self = circular;
  const result = createToolSuccessResult(circular);
  assert.deepEqual(result, { ok: false, error: 'TOOL_RESULT_CIRCULAR' });
  assert.equal(Object.isFrozen(result), true);
}

{
  let getterReads = 0;
  const hostile = {};
  Object.defineProperty(hostile, 'secret', {
    enumerable: true,
    get() {
      getterReads += 1;
      return 'must-not-run';
    }
  });
  const result = createToolSuccessResult(hostile);
  assert.deepEqual(result, { ok: false, error: 'TOOL_RESULT_INVALID' });
  assert.equal(getterReads, 0, 'tool result accessors are rejected without invocation');
}

{
  class CustomResult {
    constructor() { this.value = 'x'; }
  }
  assert.deepEqual(createToolSuccessResult(new CustomResult()), { ok: false, error: 'TOOL_RESULT_INVALID' });
  assert.deepEqual(createToolSuccessResult(new Date()), { ok: false, error: 'TOOL_RESULT_INVALID' });
  assert.deepEqual(createToolSuccessResult({ value: undefined }), { ok: false, error: 'TOOL_RESULT_INVALID' });
  assert.deepEqual(createToolSuccessResult({ value: 1n }), { ok: false, error: 'TOOL_RESULT_INVALID' });
  assert.deepEqual(createToolSuccessResult({ value: Infinity }), { ok: false, error: 'TOOL_RESULT_INVALID' });
}

{
  const withSymbol = { ok: true };
  withSymbol[Symbol('hidden')] = 'x';
  assert.deepEqual(createToolSuccessResult(withSymbol), { ok: false, error: 'TOOL_RESULT_TOO_COMPLEX' });

  const array = ['a'];
  array.extra = true;
  assert.deepEqual(createToolSuccessResult(array), { ok: false, error: 'TOOL_RESULT_INVALID' });
}

{
  let value = 'leaf';
  for (let index = 0; index < TOOL_EXECUTION_RESULT_POLICY.maxDepth + 2; index += 1) value = { value };
  assert.deepEqual(createToolSuccessResult(value), { ok: false, error: 'TOOL_RESULT_TOO_DEEP' });
}

{
  const huge = 'x'.repeat(TOOL_EXECUTION_RESULT_POLICY.maxJsonBytes + 1);
  assert.deepEqual(createToolSuccessResult({ huge }), { ok: false, error: 'TOOL_RESULT_TOO_LARGE' });
}

{
  const result = createToolFailureResult('GMAIL_READ_FAILED', { status: 503, reason: 'default_deny' });
  assert.deepEqual(result, { ok: false, error: 'GMAIL_READ_FAILED', status: 503, reason: 'default_deny' });
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(createToolFailureResult('bad code', { status: 200, reason: '\n' }), {
    ok: false,
    error: 'TOOL_EXECUTION_FAILED'
  });
  assert.deepEqual(
    createToolFailureResult('GITHUB_READ_FAILED', { status: 502, reason: 'Authorization: Bearer abcdefghijklmnop' }),
    { ok: false, error: 'GITHUB_READ_FAILED', status: 502 }
  );
}

{
  let codeReads = 0;
  let statusReads = 0;
  const hostileError = {};
  Object.defineProperty(hostileError, 'code', { get() { codeReads += 1; return 'SECRET_ERROR'; } });
  Object.defineProperty(hostileError, 'status', { get() { statusReads += 1; return 500; } });
  assert.deepEqual(createToolFailureFromError(hostileError), { ok: false, error: 'TOOL_EXECUTION_FAILED' });
  assert.equal(codeReads, 0);
  assert.equal(statusReads, 0);
}

{
  const success = createToolSuccessResult({ message: 'safe' });
  const normalized = normalizeToolExecutionResult(success);
  assert.deepEqual(normalized, success);
  assert.notEqual(normalized, success);
  assert.equal(Object.isFrozen(normalized.value), true);

  assert.deepEqual(normalizeToolExecutionResult({ ok: true, value: 'safe', extra: true }), {
    ok: false,
    error: 'TOOL_RESULT_INVALID'
  });
  assert.deepEqual(normalizeToolExecutionResult({ ok: false, error: 'GMAIL_READ_FAILED', detail: 'raw provider text' }), {
    ok: false,
    error: 'TOOL_RESULT_INVALID'
  });
}

{
  let okReads = 0;
  const hostileOutcome = {};
  Object.defineProperty(hostileOutcome, 'ok', { get() { okReads += 1; return true; } });
  Object.defineProperty(hostileOutcome, 'value', { value: { safe: true }, enumerable: true });
  assert.deepEqual(normalizeToolExecutionResult(hostileOutcome), { ok: false, error: 'TOOL_RESULT_INVALID' });
  assert.equal(okReads, 0, 'outcome getter is never executed');
}

{
  let trapCount = 0;
  const hostileProxy = new Proxy({}, {
    ownKeys() { trapCount += 1; throw new Error('proxy trap'); }
  });
  assert.deepEqual(createToolSuccessResult(hostileProxy), { ok: false, error: 'TOOL_RESULT_INVALID' });
  assert.equal(trapCount, 1);
}

console.log('tool execution result policy tests passed');
