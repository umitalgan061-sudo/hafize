export type AgentId = string;

export interface PublicAgent {
  readonly id: AgentId;
  readonly name: string;
  readonly description?: string;
  readonly tools?: readonly string[];
}

export interface AgentsResponse {
  readonly defaultAgent: AgentId;
  readonly agents: readonly PublicAgent[];
}

export interface ModelsResponse {
  readonly models: readonly string[];
}

export interface HealthResponse {
  readonly status: string;
  readonly nvidiaConfigured: boolean;
  readonly githubReadConfigured: boolean;
  readonly canvaReadConfigured: boolean;
  readonly gmailReadConfigured: boolean;
  readonly contextCompactionConfigured: boolean;
  readonly scheduleWorkerConfigured: boolean;
  readonly scheduleApiConfigured: boolean;
  readonly scheduleStorageDurable: boolean;
  readonly scheduleLeaseConfigured: boolean;
  readonly agents: number;
}

export type RuntimeConnectivity = 'online' | 'offline' | 'degraded' | 'unknown';
export type RuntimeSeverity = 'info' | 'success' | 'warning' | 'error';

export interface RuntimeSnapshot {
  readonly connectivity: RuntimeConnectivity;
  readonly checkedAt: string | null;
  readonly apiReachable: boolean;
  readonly health: HealthResponse | null;
  readonly lastErrorCode: string | null;
}

// `exactOptionalPropertyTypes` açıkken `{ signal: undefined }` ile `{}` aynı
// şey değildir; `RequestInit['signal']` ise yalnızca `AbortSignal | null`
// kabul eder. Çağıranlar isteğe bağlı bir `signal` parametresini doğrudan
// aktardığı için alan `Omit` ile ayrılıp `undefined` eklenerek yeniden
// bildirilir — böylece her çağrı yerinde anahtarı ayıklamak gerekmez.
export interface ApiRequestOptions extends Omit<RequestInit, 'signal'> {
  readonly timeoutMs?: number;
  readonly retry?: number;
  readonly signal?: AbortSignal | null | undefined;
}

export class HafizeApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly traceId: string | null;
  readonly retryable: boolean;

  constructor(message: string, options: { code?: string; status?: number; traceId?: string | null; retryable?: boolean } = {}) {
    super(message);
    this.name = 'HafizeApiError';
    this.code = options.code ?? 'API_ERROR';
    this.status = options.status ?? 0;
    this.traceId = options.traceId ?? null;
    this.retryable = options.retryable ?? false;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function parseAgents(value: unknown): AgentsResponse {
  const source = isRecord(value) ? value : {};
  const agents = Array.isArray(source.agents)
    ? source.agents.flatMap((raw): PublicAgent[] => {
        if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') return [];
        const description = typeof raw.description === 'string' ? raw.description.slice(0, 320) : undefined;
        const tools = Array.isArray(raw.tools)
          ? raw.tools.filter((tool): tool is string => typeof tool === 'string').slice(0, 64)
          : undefined;
        return [{ id: raw.id.slice(0, 160), name: raw.name.slice(0, 160), ...(description ? { description } : {}), ...(tools ? { tools } : {}) }];
      })
    : [];
  return Object.freeze({
    defaultAgent: stringValue(source.defaultAgent).slice(0, 160),
    agents: Object.freeze(agents)
  });
}

export function parseModels(value: unknown): ModelsResponse {
  const source = isRecord(value) ? value : {};
  const models = Array.isArray(source.models)
    ? source.models.filter((model): model is string => typeof model === 'string' && model.length > 0).map((model) => model.slice(0, 240)).slice(0, 200)
    : [];
  return Object.freeze({ models: Object.freeze(models) });
}

export function parseHealth(value: unknown): HealthResponse {
  const source = isRecord(value) ? value : {};
  return Object.freeze({
    status: stringValue(source.status, 'unknown').slice(0, 80),
    nvidiaConfigured: booleanValue(source.nvidiaConfigured),
    githubReadConfigured: booleanValue(source.githubReadConfigured),
    canvaReadConfigured: booleanValue(source.canvaReadConfigured),
    gmailReadConfigured: booleanValue(source.gmailReadConfigured),
    contextCompactionConfigured: booleanValue(source.contextCompactionConfigured),
    scheduleWorkerConfigured: booleanValue(source.scheduleWorkerConfigured),
    scheduleApiConfigured: booleanValue(source.scheduleApiConfigured),
    scheduleStorageDurable: booleanValue(source.scheduleStorageDurable),
    scheduleLeaseConfigured: booleanValue(source.scheduleLeaseConfigured),
    agents: Math.max(0, Math.floor(numberValue(source.agents)))
  });
}

export function connectivityFromHealth(health: HealthResponse | null, networkOnline: boolean): RuntimeConnectivity {
  if (!networkOnline) return 'offline';
  if (!health) return 'unknown';
  if (health.status !== 'ok') return 'degraded';
  return health.nvidiaConfigured ? 'online' : 'degraded';
}
