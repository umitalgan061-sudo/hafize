import { describe, expect, it } from 'vitest';
import { createToolMarkupGate, parseTextualToolCalls, readNvidiaStream, stripToolMarkup } from './nvidia-stream.ts';

const sse = (...events: unknown[]) => events.map((event) => `data: ${typeof event === 'string' ? event : JSON.stringify(event)}\n\n`).join('');
async function* chunks(text: string, size = 7) {
  const bytes = new TextEncoder().encode(text);
  for (let i = 0; i < bytes.length; i += size) yield bytes.slice(i, i + size);
}

describe('readNvidiaStream', () => {
  it('forwards answer text as it arrives, across arbitrary chunk boundaries', async () => {
    const seen: string[] = [];
    const text = sse(
      { choices: [{ delta: { reasoning_content: 'düşünüyor' } }] },
      { choices: [{ delta: { content: 'Merhaba, ' } }] },
      { choices: [{ delta: { content: 'ben Hafize. Çğüşıö' }, finish_reason: 'stop' }] },
      '[DONE]'
    );
    const result = await readNvidiaStream(chunks(text, 5), (delta) => seen.push(delta));
    expect(seen.join('')).toBe('Merhaba, ben Hafize. Çğüşıö');
    expect(result).toEqual({ content: 'Merhaba, ben Hafize. Çğüşıö', toolCalls: [], finishReason: 'stop', error: null });
  });

  it('reassembles tool calls sent in fragments', async () => {
    const text = sse(
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_a', type: 'function', function: { name: 'web_search', arguments: '' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"query":' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"Ankara"}' } }, { index: 1, id: 'call_b', function: { name: 'news_search', arguments: '{}' } }] } }] },
      { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
      '[DONE]'
    );
    const result = await readNvidiaStream(chunks(text), () => {});
    expect(result.toolCalls).toEqual([
      { id: 'call_a', name: 'web_search', arguments: '{"query":"Ankara"}' },
      { id: 'call_b', name: 'news_search', arguments: '{}' }
    ]);
    expect(result.finishReason).toBe('tool_calls');
  });

  it('never lets text-written tool calls reach the user, even when the marker is split', () => {
    const out: string[] = [];
    const gate = createToolMarkupGate((text) => out.push(text));
    for (const piece of ['Kontrol ', 'edeyim.\n\n<to', 'ol_ca', 'll>\n<function=web_search>', '...']) gate.push(piece);
    gate.flush();
    expect(out.join('')).toBe('Kontrol edeyim.');
    expect(gate.blocked).toBe(true);

    const blank: string[] = [];
    const quiet = createToolMarkupGate((text) => blank.push(text));
    for (const piece of ['\n\n', '  \n', 'Merhaba']) quiet.push(piece);
    quiet.flush();
    expect(blank.join('')).toBe('Merhaba');
    const silent: string[] = [];
    const only = createToolMarkupGate((text) => silent.push(text));
    only.push('\n\n');
    only.flush();
    expect(silent).toEqual([]);

    const plain: string[] = [];
    const open = createToolMarkupGate((text) => plain.push(text));
    for (const piece of ['a < b ve ', '<t', 'abela> etiketi']) open.push(piece);
    open.flush();
    expect(plain.join('')).toBe('a < b ve <tabela> etiketi');
  });

  it('turns text-written tool calls into real calls', () => {
    const content = 'Bakayım.\n<tool_call>\n<function=web_page_read>\n<parameter=url>\nhttps://example.com/a\n</parameter>\n</function>\n</tool_call>\n<tool_call>\n<function=news_search>\n<parameter=limit>\n3\n</parameter>\n</function>\n</tool_call>';
    expect(parseTextualToolCalls(content)).toEqual({
      text: 'Bakayım.',
      toolCalls: [
        { id: 'text_call_0', name: 'web_page_read', arguments: '{"url":"https://example.com/a"}' },
        { id: 'text_call_1', name: 'news_search', arguments: '{"limit":3}' }
      ]
    });
    expect(stripToolMarkup('Yanıt hazır.')).toBe('Yanıt hazır.');
  });

  it('reports a mid-stream error object instead of ending silently', async () => {
    const result = await readNvidiaStream(chunks(sse({ choices: [{ delta: { content: 'Ya' } }] }, { error: { message: 'upstream overloaded' } })), () => {});
    expect(result.content).toBe('Ya');
    expect(result.error).toEqual({ message: 'upstream overloaded' });
  });
});
