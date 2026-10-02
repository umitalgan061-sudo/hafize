import { describe, expect, it, vi } from 'vitest';
import {
  HafizeSseClient,
  HafizeSseError,
  consumeSseResponse,
  parseSseEventBlock
} from './hafize-sse.ts';

function responseFromChunks(chunks: readonly string[], status = 200, headers: Record<string, string> = {}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  });
  return new Response(stream, { status, headers });
}

describe('hafize-sse parser', () => {
  it('parses event, id, retry, comments and multiple data fields', () => {
    const event = parseSseEventBlock(
      ': heartbeat\r\nevent: message\r\nid: 42\r\nretry: 1500\r\ndata: {"choices":[\r\ndata: {"delta":{"content":"merhaba"}}]}'
    );
    expect(event).toEqual({
      type: 'message',
      data: '{"choices":[\n{"delta":{"content":"merhaba"}}]}',
      payload: { choices: [{ delta: { content: 'merhaba' } }] },
      id: '42',
      retry: 1500
    });
  });

  it('keeps non-json data as text', () => {
    const event = parseSseEventBlock('event: hafize-tool-activity\ndata: plain');
    expect(event?.type).toBe('hafize-tool-activity');
    expect(event?.payload).toBe('plain');
    expect(event?.data).toBe('plain');
  });

  it('recognizes the completion sentinel', () => {
    const event = parseSseEventBlock('data: [DONE]');
    expect(event?.data).toBe('[DONE]');
    expect(event?.payload).toBeNull();
  });

  it('ignores comments and empty blocks', () => {
    expect(parseSseEventBlock(': keep-alive')).toBeNull();
    expect(parseSseEventBlock('')).toBeNull();
  });

  it('bounds oversized frames', () => {
    expect(() => parseSseEventBlock('data: 123456789', 5)).toThrowError(
      expect.objectContaining({ code: 'SSE_FRAME_TOO_LARGE' })
    );
  });
});

describe('hafize-sse consumption', () => {
  it('consumes chunked frames and returns privacy-safe stream stats', async () => {
    const events: string[] = [];
    const response = responseFromChunks([
      'event: message\ndata: {"choices":[{"delta":{"content":"hel"}}]}\n\n',
      'event: message\ndata: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      'data: [DONE]\n\n'
    ], 200, { 'X-Hafize-Trace-Id': 'trace-123' });

    const stats = await consumeSseResponse(response, {
      onEvent: (event) => events.push(String((event.payload as { choices?: unknown }).choices ? 'message' : event.type))
    });

    expect(events).toEqual(['message', 'message']);
    expect(stats.status).toBe(200);
    expect(stats.traceId).toBe('trace-123');
    expect(stats.events).toBe(3);
    expect(stats.done).toBe(true);
    expect(stats.bytesRead).toBeGreaterThan(0);
    expect(stats.durationMs).toBeGreaterThanOrEqual(0);
    expect(stats.finishedAt).toBeTruthy();
  });

  it('supports an event before the completion sentinel', async () => {
    const received: string[] = [];
    const response = responseFromChunks([
      'event: custom\ndata: {"ok":true}\n\n',
      'data: [DONE]\n\n'
    ]);
    const stats = await consumeSseResponse(response, {
      onEvent: (event) => received.push(event.type)
    });
    expect(received).toEqual(['custom']);
    expect(stats.done).toBe(true);
  });

  it('rejects a missing body', async () => {
    const response = new Response(null, { status: 200 });
    await expect(consumeSseResponse(response)).rejects.toMatchObject({
      code: 'SSE_BODY_MISSING',
      status: 200
    });
  });

  it('normalizes HTTP failures and preserves trace metadata', async () => {
    const response = new Response(JSON.stringify({ error: 'RATE_LIMITED', message: 'Yavaşla' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-Hafize-Trace-Id': 'rate-trace'
      }
    });
    await expect(consumeSseResponse(response)).rejects.toEqual(
      expect.objectContaining({
        code: 'RATE_LIMITED',
        status: 429,
        traceId: 'rate-trace',
        retryable: true
      })
    );
  });

  it('enforces event count', async () => {
    const response = responseFromChunks(
      ['data: one\n\ndata: two\n\ndata: [DONE]\n\n']
    );
    await expect(consumeSseResponse(response, { maxEvents: 2 })).rejects.toMatchObject({
      code: 'SSE_EVENT_LIMIT'
    });
  });

  it('enforces the buffer limit before processing unbounded content', async () => {
    // The buffer bound can never be smaller than a single frame bound, so both
    // limits have to be below the unterminated 26 character chunk.
    const response = responseFromChunks(['data: 12345678901234567890']);
    await expect(
      consumeSseResponse(response, { maxFrameChars: 10, maxBufferChars: 10 })
    ).rejects.toMatchObject({ code: 'SSE_BUFFER_TOO_LARGE' });
  });

  it('stops callback delivery after the done sentinel', async () => {
    const received: string[] = [];
    const response = responseFromChunks([
      'data: first\n\n',
      'data: [DONE]\n\n',
      'data: ignored\n\n'
    ]);
    await consumeSseResponse(response, { onEvent: (event) => received.push(event.data) });
    expect(received).toEqual(['first']);
  });
});

describe('HafizeSseClient', () => {
  it('opens SSE requests with JSON payload and event-stream accept header', async () => {
    let captured: RequestInit | undefined;
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      captured = init;
      return responseFromChunks(['data: [DONE]\n\n']);
    });

    const client = new HafizeSseClient('/api', fetchImpl);
    await client.stream('chat', { hello: 'world' });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(captured?.method).toBe('POST');
    expect(new Headers(captured?.headers).get('Accept')).toBe('text/event-stream');
    expect(new Headers(captured?.headers).get('Content-Type')).toBe('application/json');
    expect(captured?.body).toBe(JSON.stringify({ hello: 'world' }));
  });

  it('normalizes connection failures without retrying a potentially state-changing POST', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => { throw new Error('network-down'); });
    const client = new HafizeSseClient('', fetchImpl);
    await expect(client.open('/api/chat', { message: 'x' })).rejects.toMatchObject({
      code: 'SSE_NETWORK_ERROR',
      retryable: true
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('propagates a parent abort signal into the request', async () => {
    const controller = new AbortController();
    let seenSignal: AbortSignal | undefined;
    // A real fetch rejects when its signal aborts, so the stub has to as well.
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      seenSignal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(init?.signal?.reason ?? new DOMException('Aborted', 'AbortError')),
          { once: true }
        );
      });
    });
    const client = new HafizeSseClient('', fetchImpl);

    const pending = client.open('/api/chat', {}, { signal: controller.signal, timeoutMs: 30_000 });
    controller.abort(new Error('cancelled'));

    await expect(pending).rejects.toBeInstanceOf(HafizeSseError);
    expect(seenSignal?.aborted).toBe(true);
  });

  it('uses a bounded timeout and reports it as a typed stream error', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(init?.signal?.reason ?? new DOMException('Aborted', 'AbortError')),
          { once: true }
        );
      }));
      const client = new HafizeSseClient('', fetchImpl);
      const pending = client.open('/api/chat', {}, { timeoutMs: 1_000 });
      const rejected = expect(pending).rejects.toMatchObject({ code: 'SSE_TIMEOUT' });
      await vi.advanceTimersByTimeAsync(1_000);
      await rejected;
    } finally {
      vi.useRealTimers();
    }
  });
});
