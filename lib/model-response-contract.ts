const MAX_CONTENT_LENGTH = 64_000;
const MAX_TOOL_CALLS = 16;
const MAX_FINISH_REASON = 80;
const FINISH_REASONS = new Set(['stop','length','tool_calls','content_filter','unknown'] as const);

export type ModelFinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'unknown';
export interface ModelToolCall { readonly id: string; readonly name: string; readonly arguments: string; }
export interface ModelUsage { readonly prompt_tokens?: number; readonly completion_tokens?: number; readonly total_tokens?: number; }
export interface NormalizedModelResponse {
  readonly content: string;
  readonly finishReason: ModelFinishReason;
  readonly toolCalls: readonly ModelToolCall[];
  readonly usage: Readonly<ModelUsage> | null;
  readonly model: string | null;
  readonly responseId: string | null;
}

function text(value: unknown, max: number, code: string): string {
  const result = typeof value === 'string' ? value.trim() : '';
  if (result.length > max) throw new Error(code);
  return result;
}
function normalizeContent(content: unknown): string {
  if (content == null) return '';
  if (typeof content !== 'string') throw new Error('INVALID_MODEL_CONTENT');
  return text(content, MAX_CONTENT_LENGTH, 'MODEL_CONTENT_TOO_LARGE');
}
function normalizeFinishReason(value: unknown): ModelFinishReason {
  if (value == null) return 'unknown';
  if (typeof value !== 'string') throw new Error('INVALID_MODEL_FINISH_REASON');
  const raw = text(value, MAX_FINISH_REASON, 'INVALID_MODEL_FINISH_REASON').toLowerCase();
  return (FINISH_REASONS.has(raw as ModelFinishReason) ? raw : 'unknown') as ModelFinishReason;
}
function normalizeUsage(usage: unknown): Readonly<ModelUsage> | null {
  if (usage == null) return null;
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) throw new Error('INVALID_MODEL_USAGE');
  const result: ModelUsage = {};
  for (const field of ['prompt_tokens','completion_tokens','total_tokens'] as const) {
    const value = (usage as Record<string, unknown>)[field];
    if (value != null && (!Number.isInteger(value) || Number(value) < 0)) throw new Error('INVALID_MODEL_USAGE');
    if (value != null) result[field] = Number(value);
  }
  return Object.freeze(result);
}
function normalizeToolCalls(toolCalls: unknown): readonly ModelToolCall[] {
  if (toolCalls == null) return Object.freeze([]);
  if (!Array.isArray(toolCalls) || toolCalls.length > MAX_TOOL_CALLS) throw new Error('INVALID_MODEL_TOOL_CALLS');
  return Object.freeze(toolCalls.map((call: unknown) => {
    if (!call || typeof call !== 'object' || Array.isArray(call)) throw new Error('INVALID_MODEL_TOOL_CALL');
    const value = call as Record<string, unknown>;
    const source = value.function && typeof value.function === 'object' && !Array.isArray(value.function)
      ? value.function as Record<string, unknown>
      : value;
    const id = text(value.id, 200, 'INVALID_MODEL_TOOL_CALL_ID');
    if (!id) throw new Error('INVALID_MODEL_TOOL_CALL_ID');
    const name = text(source.name, 120, 'INVALID_MODEL_TOOL_CALL_NAME');
    if (!name) throw new Error('INVALID_MODEL_TOOL_CALL_NAME');
    const args = source.arguments;
    if (typeof args !== 'string' || args.length > 16_384) throw new Error('INVALID_MODEL_TOOL_CALL');
    return Object.freeze({ id, name, arguments: args });
  }));
}
export function normalizeModelResponse(response: unknown = {}): NormalizedModelResponse {
  if (!response || typeof response !== 'object' || Array.isArray(response)) throw new Error('INVALID_MODEL_RESPONSE');
  const value = response as Record<string, unknown>;
  return Object.freeze({
    content: normalizeContent(value.content),
    finishReason: normalizeFinishReason(value.finishReason),
    toolCalls: normalizeToolCalls(value.toolCalls),
    usage: normalizeUsage(value.usage),
    model: value.model == null ? null : text(value.model, 200, 'INVALID_MODEL_NAME'),
    responseId: value.responseId == null ? null : text(value.responseId, 200, 'INVALID_MODEL_RESPONSE_ID')
  });
}
export function normalizeNvidiaChatCompletion(response: unknown = {}): NormalizedModelResponse {
  if (!response || typeof response !== 'object' || Array.isArray(response)) throw new Error('INVALID_MODEL_RESPONSE');
  const value = response as Record<string, unknown>;
  const choice = Array.isArray(value.choices) ? value.choices[0] : null;
  const message = choice && typeof choice === 'object' ? (choice as Record<string, unknown>).message : null;
  if (!message || typeof message !== 'object' || Array.isArray(message) || (message as Record<string, unknown>).role !== 'assistant') {
    throw new Error('INVALID_MODEL_RESPONSE');
  }
  const choiceValue = choice as Record<string, unknown>;
  const messageValue = message as Record<string, unknown>;
  return normalizeModelResponse({
    content: messageValue.content,
    finishReason: choiceValue.finish_reason,
    toolCalls: messageValue.tool_calls,
    usage: value.usage,
    model: value.model,
    responseId: value.id
  });
}
export function isTerminalModelResponse(response: unknown): boolean {
  const normalized = normalizeModelResponse(response);
  return normalized.finishReason !== 'tool_calls' && normalized.finishReason !== 'unknown';
}
export const MODEL_RESPONSE_CONTRACT = Object.freeze({
  maxContentLength: MAX_CONTENT_LENGTH,
  maxToolCalls: MAX_TOOL_CALLS,
  maxToolArgumentLength: 16_384,
  finishReasons: Object.freeze([...FINISH_REASONS])
});