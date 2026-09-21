import type { IncomingMessage, ServerResponse } from 'node:http';

export const HTTP_RUNTIME_DEFAULTS = Object.freeze({
  maxBodyBytes: 256 * 1024,
  maxErrorDetailLength: 1200,
  jsonContentType: 'application/json; charset=utf-8',
  sseContentType: 'text/event-stream; charset=utf-8'
});

export class HttpRuntimeError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 400) {
    super(code);
    this.name = 'HttpRuntimeError';
    this.code = code;
    this.status = status;
  }
}

function writable(res: ServerResponse): boolean {
  return !res.headersSent && !res.writableEnded && !res.destroyed;
}

export function setSecurityHeaders(res: ServerResponse): void {
  if (res.headersSent) return;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=()');
}

export function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  if (!writable(res)) return;
  setSecurityHeaders(res);
  res.writeHead(status, {
    'Content-Type': HTTP_RUNTIME_DEFAULTS.jsonContentType,
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

export function startSse(res: ServerResponse): void {
  if (!writable(res)) return;
  setSecurityHeaders(res);
  res.writeHead(200, {
    'Content-Type': HTTP_RUNTIME_DEFAULTS.sseContentType,
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
}

export function writeSseEvent(
  res: ServerResponse,
  event: string,
  payload: unknown
): boolean {
  if (!event || !writable(res) || !res.writable) return false;
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  return true;
}

export function sendSseContent(res: ServerResponse, content: string): void {
  startSse(res);
  if (content && res.writable) {
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
  }
  if (!res.writableEnded && !res.destroyed) res.end('data: [DONE]\n\n');
}

export async function readJson(
  req: IncomingMessage,
  maxBodyBytes = HTTP_RUNTIME_DEFAULTS.maxBodyBytes
): Promise<Record<string, unknown>> {
  if (!Number.isInteger(maxBodyBytes) || maxBodyBytes < 1) {
    throw new HttpRuntimeError('INVALID_BODY_LIMIT', 500);
  }

  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBodyBytes) throw new HttpRuntimeError('BODY_TOO_LARGE', 413);
    chunks.push(buffer);
  }

  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};

  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new HttpRuntimeError('INVALID_JSON_BODY', 400);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpRuntimeError) throw error;
    throw new HttpRuntimeError('INVALID_JSON_BODY', 400);
  }
}

export function requestMethod(req: IncomingMessage): string {
  return typeof req.method === 'string' ? req.method.toUpperCase() : '';
}

export function headerValue(
  headers: IncomingMessage['headers'],
  name: string
): string {
  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) return value.join(', ');
  return typeof value === 'string' ? value : '';
}

export function requestJsonAcceptsSse(req: IncomingMessage): boolean {
  return headerValue(req.headers, 'accept').toLowerCase().includes('text/event-stream');
}

export function attachDisconnectAbort(
  req: IncomingMessage,
  timeoutMs = 120_000
): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;

  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(new HttpRuntimeError('REQUEST_TIMEOUT', 408)), timeoutMs);
    timer.unref?.();
  }

  const abort = (): void => {
    if (!controller.signal.aborted) controller.abort(new HttpRuntimeError('CLIENT_DISCONNECTED', 499));
  };

  req.once('aborted', abort);
  req.once('close', abort);

  return {
    signal: controller.signal,
    cancel: () => {
      if (timer) clearTimeout(timer);
      req.off('aborted', abort);
      req.off('close', abort);
    }
  };
}
