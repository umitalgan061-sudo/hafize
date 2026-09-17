import {
  HafizeApiError,
  isRecord,
  parseAgents,
  parseHealth,
  parseModels,
  stringValue,
  type AgentsResponse,
  type ApiRequestOptions,
  type HealthResponse,
  type ModelsResponse
} from './hafize-types.ts';

export { HafizeApiError } from './hafize-types.ts';
export type { AgentsResponse, ApiRequestOptions, HealthResponse, ModelsResponse } from './hafize-types.ts';

const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;
const MAX_RETRY_DELAY_MS = 1_500;

function delay(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(resolve, ms);
    if (!signal) return;
    const abort = () => {
      globalThis.clearTimeout(timer);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, { once: true });
  });
}

function retryDelay(attempt: number): number {
  const jitter = Math.floor(Math.random() * 120);
  return Math.min(MAX_RETRY_DELAY_MS, 300 * (attempt + 1) + jitter);
}

function traceIdOf(response: Response): string | null {
  return response.headers.get('X-Hafize-Trace-Id') || null;
}

async function readPayload(response: Response): Promise<unknown> {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

function errorFromResponse(response: Response, payload: unknown): HafizeApiError {
  const body = isRecord(payload) ? payload : {};
  const code = stringValue(body.error, 'API_ERROR').slice(0, 100);
  const message = stringValue(body.message, 'İstek işlenemedi.').slice(0, 240);
  const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
  return new HafizeApiError(message, {
    code,
    status: response.status,
    traceId: traceIdOf(response),
    retryable
  });
}

export class HafizeApiClient {
  readonly baseUrl: string;
  readonly fetchImpl: typeof fetch;

  constructor(baseUrl = '', fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
  }

  private buildUrl(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const timeoutMs = Math.min(MAX_TIMEOUT_MS, Math.max(1000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS));
    const retries = Math.min(MAX_RETRIES, Math.max(0, options.retry ?? 1));
    const headers = new Headers(options.headers);
    headers.set('Accept', headers.get('Accept') || 'application/json');

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = globalThis.setTimeout(
        () => controller.abort(new DOMException('Request timeout', 'TimeoutError')),
        timeoutMs
      );
      const parentSignal = options.signal;
      const abortParent = () => controller.abort(parentSignal?.reason ?? new DOMException('Aborted', 'AbortError'));

      try {
        if (parentSignal?.aborted) abortParent();
        else parentSignal?.addEventListener('abort', abortParent, { once: true });
        const response = await this.fetchImpl(this.buildUrl(path), {
          ...options,
          signal: controller.signal,
          headers
        });
        if (!response.ok) {
          throw errorFromResponse(response, await readPayload(response));
        }
        return await response.json() as T;
      } catch (error) {
        const normalized = error instanceof HafizeApiError
          ? error
          : new HafizeApiError(
              error instanceof Error ? error.message : 'Ağ isteği başarısız.',
              {
                code: error instanceof DOMException && error.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR',
                retryable: true
              }
            );
        if (!normalized.retryable || attempt >= retries) throw normalized;
        await delay(retryDelay(attempt), parentSignal);
      } finally {
        globalThis.clearTimeout(timeout);
        parentSignal?.removeEventListener('abort', abortParent);
      }
    }
    throw new HafizeApiError('Ağ isteği başarısız.');
  }

  health(signal?: AbortSignal): Promise<HealthResponse> {
    return this.request('/api/health', { signal, timeoutMs: 8000, retry: 1 }).then(parseHealth);
  }

  models(signal?: AbortSignal): Promise<ModelsResponse> {
    return this.request('/api/models', { signal, timeoutMs: 12_000, retry: 1 }).then(parseModels);
  }

  agents(signal?: AbortSignal): Promise<AgentsResponse> {
    return this.request('/api/agents', { signal, timeoutMs: 8000, retry: 1 }).then(parseAgents);
  }
}

export const hafizeApi = new HafizeApiClient();
