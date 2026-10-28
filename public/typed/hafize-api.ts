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

const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;
const MAX_RETRY_DELAY_MS = 1_500;

function apiFetch(): typeof fetch {
  const auth = (globalThis as typeof globalThis & { HafizeAuth?: { fetch?: typeof fetch } }).HafizeAuth;
  return auth?.fetch || globalThis.fetch.bind(globalThis);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
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

export { HafizeApiError } from './hafize-types.ts';

export class HafizeApiClient {
  readonly baseUrl: string;
  readonly fetchImpl: typeof fetch;

  constructor(baseUrl = '', fetchImpl: typeof fetch = apiFetch()) {
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

  models(provider: 'nvidia' | 'local' = 'nvidia', signal?: AbortSignal): Promise<ModelsResponse> {
    return this.request(provider === 'local' ? '/api/models?provider=local' : '/api/models', { signal, timeoutMs: 12_000, retry: 1 }).then(parseModels);
  }

  agents(signal?: AbortSignal): Promise<AgentsResponse> {
    return this.request('/api/agents', { signal, timeoutMs: 8000, retry: 1 }).then(parseAgents);
  }

  private send<T = unknown>(path: string, method: string, body?: unknown, timeoutMs = 15_000): Promise<T> {
    return this.request<T>(path, {
      method,
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      timeoutMs,
      retry: method === 'GET' ? 1 : 0
    });
  }

  resolveApproval(id: string, approved: boolean, mode = 'once'): Promise<unknown> {
    return this.send(`/api/approvals/${encodeURIComponent(id)}`, 'POST', { approved, mode });
  }

  undoAction(id: string): Promise<{ undone?: boolean; summary?: string }> {
    return this.send(`/api/actions/${encodeURIComponent(id)}/undo`, 'POST', {});
  }

  listActions(): Promise<{ actions?: Array<Record<string, unknown>> }> {
    return this.send('/api/actions?limit=30', 'GET');
  }

  uploadImage(data: string, name: string): Promise<{ id: string; url: string; mime: string }> {
    return this.send('/api/uploads/image', 'POST', { data, name }, 60_000);
  }

  /** Uploads a text/code document; only the returned reference reaches the composer. */
  uploadDocument(content: string, name: string, mime: string): Promise<{ id: string; url: string; name: string; size: number }> {
    return this.send('/api/uploads/document', 'POST', { content, name, mime }, 60_000);
  }

  listDocuments(): Promise<{ documents?: Array<Record<string, unknown>> }> {
    return this.send('/api/documents', 'GET');
  }

  deleteDocument(id: string): Promise<{ removed?: boolean }> {
    return this.send(`/api/documents/${encodeURIComponent(id)}`, 'DELETE');
  }

  sendFeedback(feedback: { messageId: string; rating: string; traceId?: string; variant?: string }): Promise<unknown> {
    return this.send('/api/feedback', 'POST', feedback);
  }

  memoryList(kind = ''): Promise<{ records?: Array<Record<string, unknown>> }> {
    return this.send(`/api/memory?limit=500${kind ? `&kind=${encodeURIComponent(kind)}` : ''}`, 'GET');
  }

  memoryAdd(content: string, kind = 'semantic', id?: string): Promise<{ record?: Record<string, unknown> }> {
    return this.send('/api/memory', 'POST', { content, kind, ...(id ? { id } : {}) });
  }

  memoryDelete(id: string): Promise<unknown> {
    return this.send(`/api/memory/${encodeURIComponent(id)}`, 'DELETE');
  }

  memoryPurge(): Promise<unknown> {
    return this.send('/api/memory?confirm=all', 'DELETE');
  }

  memoryImportNotes(notes: ReadonlyArray<{ id: string; text: string }>): Promise<{ imported?: number }> {
    return this.send('/api/memory/import', 'POST', { notes });
  }

  memoryExport(): Promise<string> {
    return this.fetchImpl(this.buildUrlPublic('/api/memory/export'), { headers: { Accept: 'application/x-ndjson' } }).then((response) => {
      if (!response.ok) throw new HafizeApiError('Hafıza dışa aktarılamadı.', { code: 'MEMORY_EXPORT_FAILED', status: response.status });
      return response.text();
    });
  }

  platform<T = Record<string, unknown>>(path: string, method = 'GET', body?: unknown): Promise<T> {
    if (!/^\/api\/(capabilities|observability|experts|orchestrator|backup|actions|skills\/(catalog|updates)|prompts|images)(\/|\?|$)/.test(path)) return Promise.reject(new HafizeApiError('Geçersiz istek.', { code: 'INVALID_PLATFORM_PATH' }));
    return this.send<T>(path, method, body, method === 'GET' ? 15_000 : 120_000);
  }

  private buildUrlPublic(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  // A consent grant is a write, so it is never retried.
  grantSkillConsent(grant: { skillId: string; scopes: string[]; mode: string; argsHash?: string }, signal?: AbortSignal): Promise<unknown> {
    return this.request('/api/skills/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(grant),
      signal,
      timeoutMs: 8000,
      retry: 0
    });
  }
}

export const hafizeApi = new HafizeApiClient();
