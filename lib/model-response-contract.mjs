const MAX_CONTENT_LENGTH = 64_000;
const MAX_TOOL_CALLS = 16;
const MAX_FINISH_REASON = 80;
const FINISH_REASONS = new Set(['stop', 'length', 'tool_calls', 'content_filter', 'unknown']);

function text(value, max, code) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (result.length > max) throw new Error(code);
  return result;
}

function normalizeUsage(usage) {
  if (usage == null) return null;
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) throw new Error('INVALID_MODEL_USAGE');
  const fields = ['prompt_tokens', 'completion_tokens', 'total_tokens'];
  const normalized = {};
  for (const field of fields) {
    const value = usage[field];
    if (value != null && (!Number.isInteger(value) || value < 0)) throw new Error('INVALID_MODEL_USAGE');
    if (value != null) normalized[field] = value;
  }
  return Object.freeze(normalized);
}

function normalizeToolCalls(toolCalls) {
  if (toolCalls == null) return Object.freeze([]);
  if (!Array.isArray(toolCalls) || toolCalls.length > MAX_TOOL_CALLS) throw new Error('INVALID_MODEL_TOOL_CALLS');
  return Object.freeze(toolCalls.map((call) => {
    if (!call || typeof call !== 'object' || Array.isArray(call)) throw new Error('INVALID_MODEL_TOOL_CALL');
    const id = text(call.id, 200, 'INVALID_MODEL_TOOL_CALL_ID');
    const name = text(call.function?.name, 120, 'INVALID_MODEL_TOOL_CALL_NAME');
    const args = call.function?.arguments;
    if (!id || !name || typeof args !== 'string' || args.length > 16_384) throw new Error('INVALID_MODEL_TOOL_CALL');
    return Object.freeze({ id, name, arguments: args });
  }));
}

export function normalizeModelResponse(response = {}) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) throw new Error('INVALID_MODEL_RESPONSE');
  const content = text(response.content || '', MAX_CONTENT_LENGTH, 'MODEL_CONTENT_TOO_LARGE');
  const rawReason = text(response.finishReason || 'unknown', MAX_FINISH_REASON, 'INVALID_MODEL_FINISH_REASON').toLowerCase();
  const finishReason = FINISH_REASONS.has(rawReason) ? rawReason : 'unknown';
  const toolCalls = normalizeToolCalls(response.toolCalls);
  const usage = normalizeUsage(response.usage);
  const model = response.model == null ? null : text(response.model, 200, 'INVALID_MODEL_NAME');
  const responseId = response.responseId == null ? null : text(response.responseId, 200, 'INVALID_MODEL_RESPONSE_ID');
  return Object.freeze({ content, finishReason, toolCalls, usage, model, responseId });
}

export function isTerminalModelResponse(response) {
  const normalized = normalizeModelResponse(response);
  return normalized.finishReason !== 'tool_calls' && normalized.finishReason !== 'unknown';
}

export const MODEL_RESPONSE_CONTRACT = Object.freeze({
  maxContentLength: MAX_CONTENT_LENGTH,
  maxToolCalls: MAX_TOOL_CALLS,
  maxToolArgumentLength: 16_384,
  finishReasons: Object.freeze([...FINISH_REASONS])
});
