const MAX_CONTENT_LENGTH = 64_000;
const MAX_TOOL_CALLS = 16;
const MAX_TOOL_ARGUMENT_LENGTH = 16_384;

export type ModelFinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'unknown';

const KNOWN_FINISH_REASONS: readonly ModelFinishReason[] = Object.freeze([
  'stop',
  'length',
  'tool_calls',
  'content_filter'
]);

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

/** Requires a string, so a provider sending an object or array is rejected. */
function requiredText(value: unknown, max: number, invalidCode: string, tooLargeCode = invalidCode): string {
  if (typeof value !== 'string') throw new Error(invalidCode);
  return text(value, max, tooLargeCode);
}

function content(value: unknown): string {
  if (value == null) return '';
  return requiredText(value, MAX_CONTENT_LENGTH, 'INVALID_MODEL_CONTENT', 'MODEL_CONTENT_TOO_LARGE');
}

function finishReason(value: unknown): ModelFinishReason {
  if (value == null) return 'unknown';
  if (typeof value !== 'string') throw new Error('INVALID_MODEL_FINISH_REASON');
  const reason = text(value, 80, 'INVALID_MODEL_FINISH_REASON').toLowerCase();
  return (KNOWN_FINISH_REASONS.includes(reason as ModelFinishReason) ? reason : 'unknown') as ModelFinishReason;
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
    if (!id) throw new Error('INVALID_MODEL_TOOL_CALL_ID');
    const name = text(fn.name, 120, 'INVALID_MODEL_TOOL_CALL_NAME');
    if (!name) throw new Error('INVALID_MODEL_TOOL_CALL_NAME');
    const args = fn.arguments;
    if (typeof args !== 'string' || args.length > MAX_TOOL_ARGUMENT_LENGTH) {
      throw new Error('INVALID_MODEL_TOOL_CALL');
    }
    return Object.freeze({ id, name, arguments: args });
  }));
}

export function normalizeModelResponse(value: unknown = {}): NormalizedModelResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_MODEL_RESPONSE');
  const source = value as Record<string, unknown>;
  return Object.freeze({
    content: content(source.content),
    finishReason: finishReason(source.finishReason),
    toolCalls: toolCalls(source.toolCalls),
    usage: usage(source.usage),
    model: source.model == null ? null : requiredText(source.model, 200, 'INVALID_MODEL_NAME'),
    responseId: source.responseId == null ? null : requiredText(source.responseId, 200, 'INVALID_MODEL_RESPONSE_ID')
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

/**
 * A response is terminal when the provider finished on its own terms. A
 * `tool_calls` finish means the agent loop still owes the model a tool result,
 * and `unknown` means the provider sent a finish reason this runtime does not
 * model yet — neither is safe to treat as a completed turn.
 */
export function isTerminalModelResponse(response: unknown): boolean {
  const normalized = normalizeModelResponse(response);
  return normalized.finishReason !== 'tool_calls' && normalized.finishReason !== 'unknown';
}

export const MODEL_RESPONSE_CONTRACT = Object.freeze({
  maxContentLength: MAX_CONTENT_LENGTH,
  maxToolCalls: MAX_TOOL_CALLS,
  maxToolArgumentLength: MAX_TOOL_ARGUMENT_LENGTH,
  finishReasons: KNOWN_FINISH_REASONS
});
