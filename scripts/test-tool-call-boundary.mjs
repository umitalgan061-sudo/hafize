import assert from 'node:assert/strict';
import { normalizeToolCall, parseToolArguments, sanitizeToolError, TOOL_CALL_LIMITS } from '../lib/tool-call-boundary.mjs';

const normalized = normalizeToolCall({ id: 'call-1', type: 'function', function: { name: 'github_read_file', arguments: '{"path":"README.md"}' } });
assert.equal(normalized.id, 'call-1');
assert.equal(normalized.function.name, 'github_read_file');
assert.equal(normalized.function.arguments, '{"path":"README.md"}');
assert.throws(() => normalizeToolCall({ id: '', function: { name: 'x', arguments: '{}' } }), /INVALID_TOOL_CALL_ID/);
assert.throws(() => normalizeToolCall({ id: 'x', function: { name: '', arguments: '{}' } }), /INVALID_TOOL_NAME/);
assert.throws(() => normalizeToolCall({ id: 'x', function: { name: 'x', arguments: null } }), /INVALID_TOOL_ARGUMENTS/);
assert.throws(() => normalizeToolCall({ id: 'x', function: { name: 'x', arguments: 'a'.repeat(TOOL_CALL_LIMITS.maxArgumentsLength + 1) } }), /TOOL_ARGUMENTS_TOO_LARGE/);

assert.deepEqual(parseToolArguments('{}'), {});
assert.deepEqual(parseToolArguments('{"a":1}'), { a: 1 });
assert.throws(() => parseToolArguments('[]'), /INVALID_TOOL_ARGUMENTS/);
// Malformed provider JSON stays inside the boundary as a stable code instead of
// leaking the parser message.
assert.throws(() => parseToolArguments('{'), (error) => {
  assert.equal(error.code, 'INVALID_TOOL_ARGUMENTS');
  assert.doesNotMatch(error.message, /Unexpected|JSON/);
  return true;
});
// Every boundary rejection carries `code`, so sanitizeToolError keeps it.
for (const [call, code] of [
  [null, 'INVALID_TOOL_CALL'],
  [{ id: '', function: { name: 'x', arguments: '{}' } }, 'INVALID_TOOL_CALL_ID'],
  [{ id: 'x', function: { name: '', arguments: '{}' } }, 'INVALID_TOOL_NAME'],
  [{ id: 'x', function: { name: 'x', arguments: null } }, 'INVALID_TOOL_ARGUMENTS']
]) {
  assert.throws(() => normalizeToolCall(call), (error) => {
    assert.equal(sanitizeToolError(error).code, code);
    return true;
  });
}

const sanitized = sanitizeToolError({ code: 'UPSTREAM_FAILURE', message: 'Authorization: Bearer secret-value', status: 502 });
assert.equal(sanitized.code, 'UPSTREAM_FAILURE');
assert.equal(sanitized.status, 502);
assert.equal(sanitized.message.includes('Bearer'), true);
assert.ok(Object.isFrozen(sanitized));
assert.equal(sanitizeToolError({}).code, 'TOOL_EXECUTION_FAILED');

console.log('tool call boundary tests passed');
