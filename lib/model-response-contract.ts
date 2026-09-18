const MAX_CONTENT_LENGTH = 64_000;
const MAX_TOOL_CALLS = 16;
const MAX_TOOL_ARGUMENT_LENGTH = 16_384;

export type ModelFinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'unknown';

export interface ModelToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
}

export interface NormalizedModelResponse {
  readonly content: string;
  readonly finishReason: ModelFinishReason;
  readonly toolCalls: readonly ModelToolCall[];
  readonly usage: Readonly<Record<string, number>> | null;
  readonly model: string | null;
  readonly responseId: string | null;
}

function text(value: unknown, max: number, code: string): string {
  const result = typeof value === 'string' ? value.trim() : '';
  if (result.length > max) throw new Error(code);
  return result;
}

function finishReason(value: unknown): ModelFinishReason {
  if (value == null) return 'unknown';
  if (typeof value !== 'string') throw new Error('INVALID_MODEL_FINISH_REASON');
  const reason = text(value, 80, 'INVALID_MODEL_FINISH_REASON').toLowerCase();
  return (['stop','length','tool_calls','content_filter'].includes(reason) ? reason : 'unknown') as ModelFinishReason;
}

function usage(value: unknown): Readonly<Record<string, number>> | null {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_MODEL_USAGE');
  const output: Record<string, number> = {};
  for (const field of ['prompt_tokens','completion_tokens','total_tokens']) {
    const item = (value as Record<string, unknown>)[field];
    if (item != null && (!Number.isInteger(item) || Number(item) < 0)) throw new Error('INVALID_MODEL_USAGE');
    if (item != null) output[field] = Number(item);
  }
  return Object.freeze(output);
}

function toolCalls(value: unknown): readonly ModelToolCall[] {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_TOOL_CALLS) throw new Error('INVALID_MODEL_TOOL_CALLS');
  return Object.freeze(value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('INVALID_MODEL_TOOL_CALL');
    const call = item as Record<string, unknown>;
    const fn = call.function && typeof call.function === 'object' && !Array.isArray(call.function)
      ? call.function as Record<string, unknown>
      : call;
    const id = text(call.id, 200, 'INVALID_MODEL_TOOL_CALL_ID');
    const name = text(fn.name, 120, 'INVALID_MODEL_TOOL_CALL_NAME');
    const args = fn.arguments;
    if (!id || !name || typeof args !== 'string' || args.length > MAX_TOOL_ARGUMENT_LENGTH) {
      throw new Error('INVALID_MODEL_TOOL_CALL');
    }
    return Object.freeze({ id, name, arguments: args });
  }));
}

export function normalizeModelResponse(value: unknown = {}): NormalizedModelResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_MODEL_RESPONSE');
  const source = value as Record<string, unknown>;
  return Object.freeze({
    content: source.content == null ? '' : text(source.content, MAX_CONTENT_LENGTH, 'INVALID_MODEL_CONTENT'),
    finishReason: finishReason(source.finishReason),
    toolCalls: toolCalls(source.toolCalls),
    usage: usage(source.usage),
    model: source.model == null ? null : text(source.model, 200, 'INVALID_MODEL_NAME'),
    responseId: source.responseId == null ? null : text(source.responseId, 200, 'INVALID_MODEL_RESPONSE_ID')
  });
}

export function normalizeNvidiaChatCompletion(value: unknown = {}): NormalizedModelResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_MODEL_RESPONSE');
  const source = value as Record<string, unknown>;
  const choice = Array.isArray(source.choices) ? source.choices[0] : null;
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
    usage: source.usage,
    model: source.model,
    responseId: source.id
  });
}

export const MODEL_RESPONSE_CONTRACT = Object.freeze({
  maxContentLength: MAX_CONTENT_LENGTH,
  maxToolCalls: MAX_TOOL_CALLS,
  maxToolArgumentLength: MAX_TOOL_ARGUMENT_LENGTH
});
