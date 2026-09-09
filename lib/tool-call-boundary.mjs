const MAX_TOOL_NAME_LENGTH = 120;
const MAX_TOOL_CALL_ID_LENGTH = 200;
const MAX_ARGUMENTS_LENGTH = 16_384;
const MAX_RESULT_TEXT_LENGTH = 32_000;

// These codes are the boundary's own vocabulary and safe to surface, so they are carried
// on `error.code` where sanitizeToolError() can read them instead of collapsing to
// the generic TOOL_EXECUTION_FAILED.
function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function text(value, max, code) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || result.length > max || result.includes('\0')) fail(code);
  return result;
}

export function normalizeToolCall(toolCall) {
  if (!toolCall || typeof toolCall !== 'object' || Array.isArray(toolCall)) fail('INVALID_TOOL_CALL');
  const id = text(toolCall.id, MAX_TOOL_CALL_ID_LENGTH, 'INVALID_TOOL_CALL_ID');
  const name = text(toolCall.function?.name, MAX_TOOL_NAME_LENGTH, 'INVALID_TOOL_NAME');
  const rawArguments = toolCall.function?.arguments;
  if (typeof rawArguments !== 'string') fail('INVALID_TOOL_ARGUMENTS');
  if (rawArguments.length > MAX_ARGUMENTS_LENGTH) fail('TOOL_ARGUMENTS_TOO_LARGE');
  return Object.freeze({ id, type: 'function', function: Object.freeze({ name, arguments: rawArguments }) });
}

export function parseToolArguments(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_ARGUMENTS_LENGTH) fail('TOOL_ARGUMENTS_TOO_LARGE');
  if (!raw.trim()) return Object.freeze({});
  const value = JSON.parse(raw);
  if (!value || Array.isArray(value) || typeof value !== 'object') fail('INVALID_TOOL_ARGUMENTS');
  return Object.freeze(value);
}

export function sanitizeToolError(error) {
  const code = typeof error?.code === 'string' ? error.code.trim() : '';
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  const status = Number.isInteger(error?.status) ? error.status : null;
  return Object.freeze({
    code: (code || 'TOOL_EXECUTION_FAILED').slice(0, 120),
    message: message ? message.slice(0, MAX_RESULT_TEXT_LENGTH) : '',
    status
  });
}

export const TOOL_CALL_LIMITS = Object.freeze({
  maxToolNameLength: MAX_TOOL_NAME_LENGTH,
  maxToolCallIdLength: MAX_TOOL_CALL_ID_LENGTH,
  maxArgumentsLength: MAX_ARGUMENTS_LENGTH,
  maxResultTextLength: MAX_RESULT_TEXT_LENGTH
});
