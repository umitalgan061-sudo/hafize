import assert from 'node:assert/strict';
import { assertSafeToolExecutionValue, projectSafeToolExecutionResult, ToolExecutionResultPolicyError } from '../lib/tool-execution-result-policy.mjs';

assert.doesNotThrow(() => assertSafeToolExecutionValue({ content: 'README text', nested: { count: 2 }, list: ['safe', 'text'] }));
assert.doesNotThrow(() => assertSafeToolExecutionValue({ authorization: '', secret: null, password: undefined }));
assert.throws(
  () => assertSafeToolExecutionValue({ content: 'API_KEY=not-safe-at-all' }),
  (error) => error instanceof ToolExecutionResultPolicyError && error.code === 'TOOL_RESULT_CREDENTIAL_BLOCKED'
);
assert.throws(
  () => assertSafeToolExecutionValue({ access_token: 'opaque-token-value' }),
  (error) => error instanceof ToolExecutionResultPolicyError && error.code === 'TOOL_RESULT_CREDENTIAL_FIELD_BLOCKED'
);
assert.throws(
  () => assertSafeToolExecutionValue({ nested: { authorization: 'Bearer abcdefghijk' } }),
  (error) => error instanceof ToolExecutionResultPolicyError && error.code === 'TOOL_RESULT_CREDENTIAL_FIELD_BLOCKED'
);
assert.throws(
  () => assertSafeToolExecutionValue({ content: '-----BEGIN PRIVATE KEY-----' }),
  (error) => error instanceof ToolExecutionResultPolicyError && error.code === 'TOOL_RESULT_CREDENTIAL_BLOCKED'
);

const accessorValue = {};
Object.defineProperty(accessorValue, 'content', { enumerable: true, get() { return 'API_KEY=hidden'; } });
assert.throws(
  () => assertSafeToolExecutionValue(accessorValue),
  (error) => error instanceof ToolExecutionResultPolicyError && error.code === 'TOOL_RESULT_ACCESSOR_BLOCKED'
);

const customPrototype = Object.create({ inherited: 'ignored' });
customPrototype.content = 'safe';
assert.throws(
  () => assertSafeToolExecutionValue(customPrototype),
  (error) => error instanceof ToolExecutionResultPolicyError && error.code === 'TOOL_RESULT_SHAPE_BLOCKED'
);

const deep = {};
let cursor = deep;
for (let index = 0; index < 9; index += 1) {
  cursor.next = {};
  cursor = cursor.next;
}
assert.throws(
  () => assertSafeToolExecutionValue(deep),
  (error) => error instanceof ToolExecutionResultPolicyError && error.code === 'TOOL_RESULT_COMPLEXITY_BLOCKED'
);

const wide = {};
for (let index = 0; index < 2_001; index += 1) wide[`item${index}`] = index;
assert.throws(
  () => assertSafeToolExecutionValue(wide),
  (error) => error instanceof ToolExecutionResultPolicyError && error.code === 'TOOL_RESULT_COMPLEXITY_BLOCKED'
);

const cyclic = { nested: {} };
cyclic.nested.parent = cyclic;
assert.doesNotThrow(() => assertSafeToolExecutionValue(cyclic));

assert.deepEqual(
  projectSafeToolExecutionResult({ ok: true, value: { content: 'hello' } }),
  { ok: true, value: { content: 'hello' } }
);
assert.deepEqual(
  projectSafeToolExecutionResult({ ok: true, value: { refreshToken: 'abc123456' } }),
  { ok: false, error: 'TOOL_RESULT_CREDENTIAL_FIELD_BLOCKED' }
);
assert.deepEqual(
  projectSafeToolExecutionResult({ ok: false, error: 'UPSTREAM_FAILED', reason: 'safe' }),
  { ok: false, error: 'UPSTREAM_FAILED', reason: 'safe' }
);

console.log('Tool result policy OK: credential, shape, accessor, cycle and complexity egress guards enforced');
