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
// Bozuk JSON ham parser mesajı yerine kararlı sözleşme kodu ile reddedilir;
// aksi hâlde argüman metninin bir parçası hata mesajına sızabiliyordu.
assert.throws(() => parseToolArguments('{'), /INVALID_TOOL_ARGUMENTS/);
assert.equal(sanitizeToolError(catchError(() => parseToolArguments('{'))).code, 'INVALID_TOOL_ARGUMENTS');
function catchError(run) { try { run(); return null; } catch (error) { return error; } }

const sanitized = sanitizeToolError({ code: 'UPSTREAM_FAILURE', message: 'Authorization: Bearer secret-value', status: 502 });
assert.equal(sanitized.code, 'UPSTREAM_FAILURE');
assert.equal(sanitized.status, 502);
assert.equal(sanitized.message.includes('Bearer'), true);
assert.ok(Object.isFrozen(sanitized));
assert.equal(sanitizeToolError({}).code, 'TOOL_EXECUTION_FAILED');

console.log('tool call boundary tests passed');
