import assert from 'node:assert/strict';
import {
  TOOL_EXECUTION_RESULT_POLICY,
  createToolFailureFromError,
  createToolFailureResult,
  createToolSuccessResult
} from '../lib/tool-execution-result-policy.mjs';

{
  const error = new Error('Bearer super-secret-token provider body should never be serialized');
  error.code = 'GMAIL_READ_FAILED';
  error.status = 502;
  error.detail = 'raw upstream body';
  const result = createToolFailureFromError(error);
  assert.deepEqual(result, { ok: false, error: 'GMAIL_READ_FAILED', status: 502 });
  const encoded = JSON.stringify(result);
  assert.equal(encoded.includes('super-secret-token'), false);
  assert.equal(encoded.includes('raw upstream body'), false);
}

{
  const tooLongReason = 'x'.repeat(TOOL_EXECUTION_RESULT_POLICY.maxFailureReasonChars + 1);
  assert.deepEqual(createToolFailureResult('TOOL_NOT_AUTHORIZED', { reason: tooLongReason }), {
    ok: false,
    error: 'TOOL_NOT_AUTHORIZED'
  });
  assert.deepEqual(createToolFailureResult('TOOL_NOT_AUTHORIZED', { reason: 'approval_required' }), {
    ok: false,
    error: 'TOOL_NOT_AUTHORIZED',
    reason: 'approval_required'
  });
}

{
  for (const status of [399, 600, -1, 200, 0, null, '503']) {
    assert.deepEqual(createToolFailureResult('TOOL_EXECUTION_FAILED', { status }), {
      ok: false,
      error: 'TOOL_EXECUTION_FAILED'
    });
  }
  assert.deepEqual(createToolFailureResult('TOOL_EXECUTION_FAILED', { status: 499 }), {
    ok: false,
    error: 'TOOL_EXECUTION_FAILED',
    status: 499
  });
}

{
  const value = { content: '🙂'.repeat(90_000) };
  const result = createToolSuccessResult(value);
  assert.equal(result.ok, true);
  const encoded = JSON.stringify(result);
  assert.ok(Buffer.byteLength(encoded, 'utf8') <= TOOL_EXECUTION_RESULT_POLICY.maxJsonBytes + 64);
}

{
  const codes = ['', 'lower_case', 'WITH-DASH', 'A'.repeat(121), ' BAD_CODE ', 'SAFE_CODE'];
  assert.equal(createToolFailureResult(codes[0]).error, 'TOOL_EXECUTION_FAILED');
  assert.equal(createToolFailureResult(codes[1]).error, 'TOOL_EXECUTION_FAILED');
  assert.equal(createToolFailureResult(codes[2]).error, 'TOOL_EXECUTION_FAILED');
  assert.equal(createToolFailureResult(codes[3]).error, 'TOOL_EXECUTION_FAILED');
  assert.equal(createToolFailureResult(codes[4]).error, 'BAD_CODE');
  assert.equal(createToolFailureResult(codes[5]).error, 'SAFE_CODE');
}

console.log('tool result public error envelope tests passed');
