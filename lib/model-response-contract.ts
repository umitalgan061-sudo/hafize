export type ModelFinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'unknown';

export interface ModelToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ModelUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface NormalizedModelResponse {
  content: string;
  finishReason: ModelFinishReason;
  toolCalls: readonly ModelToolCall[];
  usage: Readonly<ModelUsage> | null;
  model: string | null;
  responseId: string | null;
}

const MAX_CONTENT_LENGTH = 64_000;
const MAX_TOOL_CALLS = 16;
const MAX_FINISH_REASON = 80;
const MAX_TOOL_ARGUMENT_LENGTH = 16_384;
const FINISH_REASONS = new Set<ModelFinishReason>(['stop', 'length', 'tool_calls', 'content_filter', 'unknown']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  const rawReason = text(value, MAX_FINISH_REASON, 'INVALID_MODEL_FINISH_REASON').toLowerCase();
  return FINISH_REASONS.has(rawReason as ModelFinishReason) ? rawReason as ModelFinishReason : 'unknown';
}

function normalizeUsage(usage: unknown): Readonly<ModelUsage> | null {
  if (usage == null) return null;
  if (!isRecord(usage)) throw new Error('INVALID_MODEL_USAGE');
  const fields: Array<keyof ModelUsage> = ['prompt_tokens', 'completion_tokens', 'total_tokens'];
  const normalized: ModelUsage = {};
  for (const field of fields) {
    const value = usage[field];
    if (value != null && (!Number.isInteger(value) || value < 0)) throw new Error('INVALID_MODEL_USAGE');
    if (value != null) normalized[field] = value as number;
  }
  return Object.freeze(normalized);
}

function normalizeToolCalls(toolCalls: unknown): readonly ModelToolCall[] {
  if (toolCalls == null) return Object.freeze([]);
  if (!Array.isArray(toolCalls) || toolCalls.length > MAX_TOOL_CALLS) throw new Error('INVALID_MODEL_TOOL_CALLS');
  return Object.freeze(toolCalls.map((call): ModelToolCall => {
    if (!isRecord(call)) throw new Error('INVALID_MODEL_TOOL_CALL');
    // Accept both provider shape and normalized shape; normalization stays idempotent.
    const source = isRecord(call.function) ? call.function : call;
    const id = text(call.id, 200, 'INVALID_MODEL_TOOL_CALL_ID');
    if (!id) throw new Error('INVALID_MODEL_TOOL_CALL_ID');
    const name = text(source.name, 120, 'INVALID_MODEL_TOOL_CALL_NAME');
    if (!name) throw new Error('INVALID_MODEL_TOOL_CALL_NAME');
    const args = source.arguments;
    if (typeof args !== 'string' || args.length > MAX_TOOL_ARGUMENT_LENGTH) throw new Error('INVALID_MODEL_TOOL_CALL');
    return Object.freeze({ id, name, arguments: args });
  }));
}

export function normalizeModelResponse(response: unknown = {}): NormalizedModelResponse {
  if (!isRecord(response)) throw new Error('INVALID_MODEL_RESPONSE');
  const content = normalizeContent(response.content);
  const finishReason = normalizeFinishReason(response.finishReason);
  const toolCalls = normalizeToolCalls(response.toolCalls);
  const usage = normalizeUsage(response.usage);
  const model = response.model == null ? null : text(response.model, 200, 'INVALID_MODEL_NAME');
  const responseId = response.responseId == null ? null : text(response.responseId, 200, 'INVALID_MODEL_RESPONSE_ID');
  return Object.freeze({ content, finishReason, toolCalls, usage, model, responseId });
}

export function normalizeNvidiaChatCompletion(response: unknown = {}): NormalizedModelResponse {
  if (!isRecord(response)) throw new Error('INVALID_MODEL_RESPONSE');
  const choice = Array.isArray(response.choices) && response.choices.length ? response.choices[0] : null;
  if (!isRecord(choice) || !isRecord(choice.message) || choice.message.role !== 'assistant') throw new Error('INVALID_MODEL_RESPONSE');
  return normalizeModelResponse({
    content: choice.message.content,
    finishReason: choice.finish_reason,
    toolCalls: choice.message.tool_calls,
    usage: response.usage,
    model: response.model,
    responseId: response.id
  });
}

export function isTerminalModelResponse(response: NormalizedModelResponse | unknown): boolean {
  const normalized = normalizeModelResponse(response);
  return normalized.finishReason !== 'tool_calls' && normalized.finishReason !== 'unknown';
}

export const MODEL_RESPONSE_CONTRACT = Object.freeze({
  maxContentLength: MAX_CONTENT_LENGTH,
  maxToolCalls: MAX_TOOL_CALLS,
  maxToolArgumentLength: MAX_TOOL_ARGUMENT_LENGTH,
  finishReasons: Object.freeze([...FINISH_REASONS])
});
