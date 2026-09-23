import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import { readJson, requestJsonAcceptsSse, sendJson, startSse, writeSseEvent } from './http-runtime.ts';

type ResponseStub = import('node:http').ServerResponse & {
  readonly headers: Map<string, string>;
  readonly body: string;
  readonly status: number;
};

function responseStub(): ResponseStub {
  const headers = new Map<string, string>();
  let body = '';
  let status = 0;
  let ended = false;
  const stub = {
    headers,
    get body() { return body; },
    get status() { return status; },
    headersSent: false,
    get writableEnded() { return ended; },
    destroyed: false,
    writable: true,
    setHeader(name: string, value: string) { headers.set(name, value); },
    writeHead(value: number, extraHeaders: Record<string, string> = {}) {
      status = value;
      for (const [name, headerValue] of Object.entries(extraHeaders)) headers.set(name, headerValue);
    },
    write(chunk: string) { body += chunk; return true; },
    end(chunk = '') { body += chunk; ended = true; }
  };
  return stub as unknown as ResponseStub;
}

describe('http runtime', () => {
  it('parses bounded JSON bodies and rejects non-objects', async () => {
    const req = Readable.from(['{"ok":true}']) as unknown as import('node:http').IncomingMessage;
    await expect(readJson(req)).resolves.toEqual({ ok: true });
    const bad = Readable.from(['[]']) as unknown as import('node:http').IncomingMessage;
    await expect(readJson(bad)).rejects.toMatchObject({ code: 'INVALID_JSON_BODY', status: 400 });
  });

  it('enforces body size limits', async () => {
    const req = Readable.from(['12345']) as unknown as import('node:http').IncomingMessage;
    await expect(readJson(req, 3)).rejects.toMatchObject({ code: 'BODY_TOO_LARGE', status: 413 });
  });

  it('writes no-store JSON with security headers', () => {
    const res = responseStub();
    sendJson(res, 200, { ok: true });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.body).toBe('{"ok":true}');
  });

  it('writes SSE headers and named events', () => {
    const res = responseStub();
    startSse(res);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    expect(writeSseEvent(res, 'test', { ok: true })).toBe(true);
    expect(res.body).toContain('event: test');
    expect(res.body).toContain('{"ok":true}');
  });

  it('detects SSE clients case-insensitively', () => {
    const req = { headers: { accept: 'application/json, Text/Event-Stream' } } as import('node:http').IncomingMessage;
    expect(requestJsonAcceptsSse(req)).toBe(true);
  });
});
