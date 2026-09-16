import {
  HafizeApiError,
  asString,
  isRecord,
  parseAgents,
  parseHealth,
  parseModels,
  type AgentsResponse,
  type ApiRequestOptions,
  type HealthResponse,
  type ModelsResponse
} from './hafize-types.ts';

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_RETRIES = 1;
const MAX_RETRY_DELAY_MS = 1_500;

const sleep = (ms: number, signal?: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
  const timer = globalThis.setTimeout(resolve, ms);
  if (!signal) return;
  if (signal.aborted) {
    globalThis.clearTimeout(timer);
    reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    return;
  }
  signal.addEventListener('abort', () => {
    globalThis.clearTimeout(timer);
    reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
  }, { once: true });
});

function retryDelay(attempt: number): number {
  const jitter = Math.floor(Math.random() * 120);
  return Math.min(MAX_RETRY_DELAY_MS, 350 * (attempt + 1) + jitter);
}

function readTraceId(response: Response): string | null {
  return response.headers.get('X-Hafize-Trace-Id') || null;
}

function parseErrorPayload(value: unknown): { code: string; message: string } {
  if (!isRecord(value)) return { code: 'API_ERROR', message: 'İstek işlenemedi.' };
  const code = asString(value.error, 'API_ERROR').slice(0, 100);
  const message = asString(value.message, '').slice(0, 240);
  return { code, message: message || 'İstek işlenemedi.' };
}

export class HafizeApiClient {
  readonly baseUrl: string;
  readonly fetchImpl: typeof fetch;

  constructor(baseUrl = '', fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
  }

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const timeoutMs = Math.max(1_000, Math.min(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 60_000));
    const retries = Math.max(0, Math.min(options.retry ?? DEFAULT_RETRIES, 3));
    const headers = new Headers(options.headers);
    headers.set('Accept', headers.get('Accept') || 'application/json');

    let lastError: unknown = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = globalThis.setTimeout(() => controller.abort(new DOMException('Request timeout', 'TimeoutError')), timeoutMs);
      const upstreamSignal = options.signal;
      const abortFromCaller = () => controller.abort(upstreamSignal?.reason ?? new DOMException('Aborted', 'AbortError'));
      if (upstreamSignal) {
        if (upstreamSignal.aborted) abortFromCaller();
        else upstreamSignal.addEventListener('abort', abortFromCaller, { once: true });
      }
      try {
        const response = await this.fetchImpl(this.url(path), {
          ...options,
          signal: controller.signal,
          headers
        });
        if (!response.ok) {
          let payload: unknown = null;
          try { payload = await response.clone().json(); } catch { /* non-JSON upstream errors */ }
          const parsed = parseErrorPayload(payload);
          const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
          throw new HafizeApiError(parsed.message, {
            code: parsed.code,
            status: response.status,
            traceId: readTraceId(response),
            retryable
          });
        }
        return await response.json() as T;
      } catch (error) {
        lastError = error;
        const normalized = error instanceof HafizeApiError
          ? error
          : new HafizeApiError(error instanceof Error ? error.message : 'Ağ isteği başarısız.', {
              code: error instanceof DOMException && error.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR',
              retryable: true
            });
        if (attempt >= retries || !normalized.retryable) throw normalized;
        await sleep(retryDelay(attempt), upstreamSignal);
      } finally {
        globalThis.clearTimeout(timeout);
        upstreamSignal?.removeEventListener('abort', abortFromCaller);
      }
    }
    throw lastError instanceof Error ? lastError : new HafizeApiError('Ağ isteği başarısız.');
  }

  async health(signal?: AbortSignal): Promise<HealthResponse> {
    return parseHealth(await this.request('/api/health', { signal, retry: 1 }));
  }

  async models(signal?: AbortSignal): Promise<ModelsResponse> {
    return parseModels(await this.request('/api/models', { signal, retry: 1 }));
  }

  async agents(signal?: AbortSignal): Promise<AgentsResponse> {
    return parseAgents(await this.request('/api/agents', { signal, retry: 1 }));
  }
}

export const hafizeApi = new HafizeApiClient();
