const MAX_CONTENT_LENGTH = 64_000;
const MAX_TOOL_CALLS = 16;
const MAX_FINISH_REASON = 80;
const FINISH_REASONS = new Set(['stop', 'length', 'tool_calls', 'content_filter', 'unknown']);

function text(value, max, code) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (result.length > max) throw new Error(code);
  return result;
}

function normalizeContent(content) {
  if (content == null) return '';
  if (typeof content !== 'string') throw new Error('INVALID_MODEL_CONTENT');
  return text(content, MAX_CONTENT_LENGTH, 'MODEL_CONTENT_TOO_LARGE');
}

function normalizeFinishReason(value) {
  if (value == null) return 'unknown';
  if (typeof value !== 'string') throw new Error('INVALID_MODEL_FINISH_REASON');
  const rawReason = text(value, MAX_FINISH_REASON, 'INVALID_MODEL_FINISH_REASON').toLowerCase();
  return FINISH_REASONS.has(rawReason) ? rawReason : 'unknown';
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
    // Accepts both the provider envelope ({ function: { name, arguments } }) and an
    // already normalized call, so normalization stays idempotent.
    const id = text(call.id, 200, 'INVALID_MODEL_TOOL_CALL_ID');
    const name = text(call.function?.name ?? call.name, 120, 'INVALID_MODEL_TOOL_CALL_NAME');
    const args = call.function?.arguments ?? call.arguments;
    if (!id) throw new Error('INVALID_MODEL_TOOL_CALL_ID');
    if (!name) throw new Error('INVALID_MODEL_TOOL_CALL_NAME');
    if (typeof args !== 'string' || args.length > 16_384) throw new Error('INVALID_MODEL_TOOL_CALL');
    return Object.freeze({ id, name, arguments: args });
  }));
}

export function normalizeModelResponse(response = {}) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) throw new Error('INVALID_MODEL_RESPONSE');
  const content = normalizeContent(response.content);
  const finishReason = normalizeFinishReason(response.finishReason);
  const toolCalls = normalizeToolCalls(response.toolCalls);
  const usage = normalizeUsage(response.usage);
  const model = response.model == null ? null : text(response.model, 200, 'INVALID_MODEL_NAME');
  const responseId = response.responseId == null ? null : text(response.responseId, 200, 'INVALID_MODEL_RESPONSE_ID');
  return Object.freeze({ content, finishReason, toolCalls, usage, model, responseId });
}

export function normalizeNvidiaChatCompletion(response = {}) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) throw new Error('INVALID_MODEL_RESPONSE');
  const choice = Array.isArray(response.choices) ? response.choices[0] : null;
  const message = choice?.message;
  if (!message || message.role !== 'assistant') throw new Error('INVALID_MODEL_RESPONSE');
  return normalizeModelResponse({
    content: message.content,
    finishReason: choice.finish_reason,
    toolCalls: message.tool_calls,
    usage: response.usage,
    model: response.model,
    responseId: response.id
  });
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
