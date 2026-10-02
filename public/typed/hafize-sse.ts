import { HafizeApiError } from './hafize-types.ts';

export interface HafizeSseEvent<T = unknown> {
  readonly type: string;
  readonly data: string;
  readonly payload: T | string | null;
  readonly id: string | null;
  readonly retry: number | null;
}

export interface HafizeSseStats {
  readonly status: number;
  readonly traceId: string | null;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly bytesRead: number;
  readonly events: number;
  readonly done: boolean;
}

export interface HafizeSseLimits {
  readonly maxFrameChars?: number;
  readonly maxBufferChars?: number;
  readonly maxEvents?: number;
}

export interface HafizeSseOptions extends HafizeSseLimits {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly headers?: HeadersInit;
  readonly onEvent?: (event: HafizeSseEvent) => void | Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_TIMEOUT_MS = 300_000;
const DEFAULT_MAX_FRAME_CHARS = 128 * 1024;
const DEFAULT_MAX_BUFFER_CHARS = 256 * 1024;
const DEFAULT_MAX_EVENTS = 20_000;

export class HafizeSseError extends Error {
  readonly code: string;
  readonly status: number;
  readonly traceId: string | null;
  readonly retryable: boolean;

  constructor(
    message: string,
    options: {
      readonly code?: string;
      readonly status?: number;
      readonly traceId?: string | null;
      readonly retryable?: boolean;
      readonly cause?: unknown;
    } = {}
  ) {
    super(message);
    this.name = 'HafizeSseError';
    this.code = (options.code || 'SSE_ERROR').slice(0, 100);
    this.status = Number.isInteger(options.status) ? options.status as number : 0;
    this.traceId = options.traceId ?? null;
    this.retryable = options.retryable === true;
    if ('cause' in options) Object.defineProperty(this, 'cause', { value: options.cause, enumerable: false });
  }
}

function traceIdOf(response: Response): string | null {
  const value = response.headers.get('X-Hafize-Trace-Id');
  return value ? value.slice(0, 120) : null;
}

async function payloadOf(response: Response): Promise<unknown> {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

function errorFromResponse(response: Response, payload: unknown): HafizeSseError {
  const record = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  const code = typeof record.error === 'string' ? record.error : 'SSE_HTTP_ERROR';
  const message = typeof record.message === 'string' ? record.message : response.statusText || 'Akış başlatılamadı.';
  const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
  return new HafizeSseError(message.slice(0, 240), {
    code,
    status: response.status,
    traceId: traceIdOf(response),
    retryable
  });
}

function normalizeLimit(value: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(value as number)));
}

function parseRetry(value: string): number | null {
  if (!value || !/^\\d+$/.test(value)) return null;
  return Math.min(3_600_000, Number(value));
}

export function parseSseEventBlock(block: string, maxFrameChars = DEFAULT_MAX_FRAME_CHARS): HafizeSseEvent | null {
  if (block.length > maxFrameChars) {
    throw new HafizeSseError('SSE veri çerçevesi izin verilen boyutu aştı.', {
      code: 'SSE_FRAME_TOO_LARGE'
    });
  }

  let type = 'message';
  let id: string | null = null;
  let retry: number | null = null;
  const data: string[] = [];

  for (const rawLine of block.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n').split('\\n')) {
    if (!rawLine || rawLine.startsWith(':')) continue;
    const separator = rawLine.indexOf(':');
    const field = separator >= 0 ? rawLine.slice(0, separator) : rawLine;
    const value = separator >= 0 ? rawLine.slice(separator + 1).replace(/^ /, '') : '';

    if (field === 'event') type = value.slice(0, 100) || 'message';
    else if (field === 'id') id = value.slice(0, 120) || null;
    else if (field === 'retry') retry = parseRetry(value);
    else if (field === 'data') data.push(value);
  }

  const joined = data.join('\\n');
  if (!joined && id === null && retry === null) return null;
  if (joined === '[DONE]') {
    return Object.freeze({ type, data: joined, payload: null, id, retry });
  }

  let payload: unknown = joined || null;
  if (joined) {
    try {
      payload = JSON.parse(joined) as unknown;
    } catch {
      payload = joined;
    }
  }

  return Object.freeze({ type, data: joined, payload, id, retry });
}

export async function consumeSseResponse(
  response: Response,
  options: HafizeSseOptions = {}
): Promise<HafizeSseStats> {
  const started = new Date();
  const maxFrameChars = normalizeLimit(options.maxFrameChars, DEFAULT_MAX_FRAME_CHARS, 1_000_000);
  const maxBufferChars = Math.max(maxFrameChars, normalizeLimit(options.maxBufferChars, DEFAULT_MAX_BUFFER_CHARS, 2_000_000));
  const maxEvents = normalizeLimit(options.maxEvents, DEFAULT_MAX_EVENTS, 100_000);
  const traceId = traceIdOf(response);

  if (!response.ok) throw errorFromResponse(response, await payloadOf(response));
  if (!response.body) {
    throw new HafizeSseError('SSE yanıt gövdesi bulunamadı.', {
      code: 'SSE_BODY_MISSING',
      status: response.status,
      traceId
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let buffer = '';
  let bytesRead = 0;
  let events = 0;
  let done = false;

  const emit = async (block: string): Promise<void> => {
    if (!block.trim()) return;
    const event = parseSseEventBlock(block, maxFrameChars);
    if (!event) return;
    events += 1;
    if (events > maxEvents) {
      throw new HafizeSseError('SSE akışındaki olay sayısı sınırı aşıldı.', {
        code: 'SSE_EVENT_LIMIT',
        status: response.status,
        traceId
      });
    }
    if (event.data === '[DONE]') {
      done = true;
      return;
    }
    await options.onEvent?.(event);
  };

  try {
    while (!done) {
      if (options.signal?.aborted) {
        throw new HafizeSseError('SSE akışı iptal edildi.', {
          code: 'SSE_ABORTED',
          status: response.status,
          traceId,
          retryable: false
        });
      }
      const chunk = await reader.read();
      bytesRead += chunk.value?.byteLength || 0;
      buffer += decoder.decode(chunk.value || new Uint8Array(), { stream: !chunk.done }).replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');
      if (buffer.length > maxBufferChars) {
        throw new HafizeSseError('SSE tamponu izin verilen boyutu aştı.', {
          code: 'SSE_BUFFER_TOO_LARGE',
          status: response.status,
          traceId
        });
      }
      const blocks = buffer.split('\\n\\n');
      buffer = blocks.pop() || '';
      for (const block of blocks) await emit(block);
      if (chunk.done) {
        const tail = buffer;
        buffer = '';
        if (tail) await emit(tail);
        break;
      }
    }
  } catch (error) {
    try { await reader.cancel(error); } catch { /* already closed */ }
    if (error instanceof HafizeSseError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new HafizeSseError('SSE akışı iptal edildi.', {
        code: 'SSE_ABORTED',
        status: response.status,
        traceId,
        retryable: false,
        cause: error
      });
    }
    throw new HafizeSseError(error instanceof Error ? error.message : 'SSE akışı okunamadı.', {
      code: 'SSE_READ_ERROR',
      status: response.status,
      traceId,
      retryable: true,
      cause: error
    });
  } finally {
    reader.releaseLock();
  }

  const finished = new Date();
  return Object.freeze({
    status: response.status,
    traceId,
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    durationMs: Math.max(0, finished.getTime() - started.getTime()),
    bytesRead,
    events,
    done
  });
}

export class HafizeSseClient {
  readonly baseUrl: string;
  readonly fetchImpl: typeof fetch;

  constructor(baseUrl = '', fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)) {
    this.baseUrl = baseUrl.replace(/\\/+$/, '');
    this.fetchImpl = fetchImpl;
  }

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  async open(path: string, payload: unknown, options: HafizeSseOptions = {}): Promise<Response> {
    const timeoutMs = Math.min(MAX_TIMEOUT_MS, Math.max(1_000, Math.floor(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)));
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(new DOMException('Request timeout', 'TimeoutError')), timeoutMs);
    const parentSignal = options.signal;
    const abortParent = () => controller.abort(parentSignal?.reason ?? new DOMException('Aborted', 'AbortError'));

    try {
      if (parentSignal?.aborted) abortParent();
      else parentSignal?.addEventListener('abort', abortParent, { once: true });

      const headers = new Headers(options.headers);
      headers.set('Accept', 'text/event-stream');
      headers.set('Content-Type', headers.get('Content-Type') || 'application/json');

      const response = await this.fetchImpl(this.url(path), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) throw errorFromResponse(response, await payloadOf(response));
      return response;
    } catch (error) {
      if (error instanceof HafizeApiError) throw error;
      if (error instanceof HafizeSseError) throw error;
      const code = error instanceof DOMException && error.name === 'TimeoutError' ? 'SSE_TIMEOUT' : 'SSE_NETWORK_ERROR';
      throw new HafizeSseError(
        error instanceof Error ? error.message : 'SSE isteği başarısız.',
        { code, retryable: true, cause: error }
      );
    } finally {
      globalThis.clearTimeout(timer);
      parentSignal?.removeEventListener('abort', abortParent);
    }
  }

  async stream(
    path: string,
    payload: unknown,
    options: HafizeSseOptions = {}
  ): Promise<HafizeSseStats> {
    const response = await this.open(path, payload, options);
    return consumeSseResponse(response, options);
  }
}
