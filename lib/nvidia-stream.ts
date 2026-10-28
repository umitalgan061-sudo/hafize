// Reads one OpenAI-compatible streamed chat completion, forwarding answer text as it arrives
// and reassembling tool calls that the upstream sends in fragments.
export interface StreamedToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
}
export interface StreamRoundResult {
  readonly content: string;
  readonly toolCalls: readonly StreamedToolCall[];
  readonly finishReason: string | null;
  readonly error: unknown;
  /** Token usage, when the upstream reports it (stream_options.include_usage). */
  readonly usage?: { readonly prompt_tokens?: number; readonly completion_tokens?: number };
}

const MAX_LINE_CHARS = 512 * 1024;
const TOOL_MARKUP = '<tool_call';

/**
 * Some models occasionally write a tool call as text (`<tool_call><function=name>...`) instead of
 * using the structured field. The gate forwards normal text but never lets that markup reach the
 * user, including when the marker is split across stream chunks.
 */
export function createToolMarkupGate(emit: (text: string) => void) {
  let held = '';
  let blocked = false;
  let started = false;
  // Leading whitespace (models often send a blank preamble before a tool call) is never emitted.
  const write = (text: string): void => {
    const output = started ? text : text.replace(/^\s+/, '');
    if (!output) return;
    started = true;
    emit(output);
  };
  return {
    push(delta: string): void {
      if (blocked || !delta) return;
      held += delta;
      const index = held.indexOf(TOOL_MARKUP);
      if (index !== -1) {
        if (held.slice(0, index).trim()) write(held.slice(0, index).trimEnd());
        held = '';
        blocked = true;
        return;
      }
      let keep = 0;
      for (let size = Math.min(TOOL_MARKUP.length - 1, held.length); size > 0; size -= 1) {
        if (TOOL_MARKUP.startsWith(held.slice(-size))) { keep = size; break; }
      }
      // Trailing whitespace is held too, so a cut-off answer does not end in blank lines.
      while (keep < held.length && /\s/.test(held[held.length - keep - 1])) keep += 1;
      const ready = held.slice(0, held.length - keep);
      if (ready) write(ready);
      held = held.slice(held.length - keep);
    },
    flush(): void {
      if (!blocked && held) write(held);
      held = '';
    },
    get blocked(): boolean { return blocked; }
  };
}

function coerceParameter(raw: string): unknown {
  const value = raw.trim();
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (/^(\[|\{)/.test(value)) { try { return JSON.parse(value); } catch {} }
  if (value === 'true' || value === 'false') return value === 'true';
  return value;
}

/** Extracts text-written tool calls and returns the remaining prose. */
export function parseTextualToolCalls(content: string): { readonly toolCalls: StreamedToolCall[]; readonly text: string } {
  const toolCalls: StreamedToolCall[] = [];
  const blocks = /<tool_call>\s*<function=([\w.-]+)>([\s\S]*?)<\/function>\s*(?:<\/tool_call>|$)/g;
  let match: RegExpExecArray | null;
  while ((match = blocks.exec(content)) && toolCalls.length < 8) {
    const args: Record<string, unknown> = {};
    for (const parameter of match[2].matchAll(/<parameter=([\w.-]+)>([\s\S]*?)<\/parameter>/g)) args[parameter[1]] = coerceParameter(parameter[2]);
    toolCalls.push({ id: `text_call_${toolCalls.length}`, name: match[1], arguments: JSON.stringify(args) });
  }
  return { toolCalls, text: stripToolMarkup(content) };
}

export function stripToolMarkup(content: string): string {
  const index = content.indexOf(TOOL_MARKUP);
  return (index === -1 ? content : content.slice(0, index)).trim();
}

export async function readNvidiaStream(
  body: AsyncIterable<Uint8Array | string>,
  onContent: (delta: string) => void
): Promise<StreamRoundResult> {
  const decoder = new TextDecoder();
  const calls: { id: string; name: string; arguments: string }[] = [];
  let buffer = '';
  let content = '';
  let finishReason: string | null = null;
  let error: unknown = null;
  let usage: { prompt_tokens?: number; completion_tokens?: number } | null = null;
  let done = false;

  const handleLine = (line: string): void => {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data) return;
    if (data === '[DONE]') { done = true; return; }
    let payload: Record<string, any>;
    try { payload = JSON.parse(data); } catch { return; }
    if (payload?.error) { error = payload.error; return; }
    if (payload?.usage && typeof payload.usage === 'object') usage = payload.usage;
    const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
    if (!choice) return;
    const delta = choice.delta || {};
    if (typeof delta.content === 'string' && delta.content) {
      content += delta.content;
      onContent(delta.content);
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const fragment of delta.tool_calls) {
        const index = Number.isInteger(fragment?.index) ? fragment.index : calls.length ? calls.length - 1 : 0;
        const slot = calls[index] ||= { id: '', name: '', arguments: '' };
        if (typeof fragment?.id === 'string' && fragment.id) slot.id = fragment.id;
        if (typeof fragment?.function?.name === 'string' && fragment.function.name && !slot.name) slot.name = fragment.function.name;
        if (typeof fragment?.function?.arguments === 'string') slot.arguments += fragment.function.arguments;
      }
    }
    if (typeof choice.finish_reason === 'string' && choice.finish_reason) finishReason = choice.finish_reason;
  };

  for await (const chunk of body) {
    buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      handleLine(buffer.slice(0, newline).replace(/\r$/, ''));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
    }
    if (buffer.length > MAX_LINE_CHARS) buffer = '';
    if (done) break;
  }
  if (!done && buffer) handleLine(buffer.replace(/\r$/, ''));

  const toolCalls = calls
    .map((call, index) => ({ id: call.id || `call_${index}`, name: call.name, arguments: call.arguments || '{}' }))
    .filter((call) => call.name);
  return { content, toolCalls, finishReason, error, ...(usage ? { usage } : {}) };
}
