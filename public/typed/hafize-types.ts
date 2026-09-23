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

export interface ApiRequestOptions extends Omit<RequestInit, 'signal'> {
  readonly signal?: AbortSignal | null | undefined;
  readonly timeoutMs?: number;
  readonly retry?: number;
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

const PROTOTYPE_LIKE_IDENTIFIERS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Agent identifiers are used as lookup keys in the UI, so a server (or a
 * tampered response) must never hand back a name that collides with an
 * `Object.prototype` member. Such identifiers are dropped rather than escaped.
 */
export function safeAgentIdentifier(value: unknown, maxLength = 160): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || PROTOTYPE_LIKE_IDENTIFIERS.has(text)) return '';
  return text.slice(0, maxLength);
}

export function parseAgents(value: unknown): AgentsResponse {
  const source = isRecord(value) ? value : {};
  const agents = Array.isArray(source.agents)
    ? source.agents.flatMap((raw): PublicAgent[] => {
        if (!isRecord(raw) || typeof raw.name !== 'string') return [];
        const id = safeAgentIdentifier(raw.id);
        if (!id) return [];
        const description = typeof raw.description === 'string' ? raw.description.slice(0, 320) : undefined;
        const tools = Array.isArray(raw.tools)
          ? raw.tools.filter((tool): tool is string => typeof tool === 'string').slice(0, 64)
          : undefined;
        return [{ id, name: raw.name.slice(0, 160), ...(description ? { description } : {}), ...(tools ? { tools } : {}) }];
      })
    : [];
  return Object.freeze({
    defaultAgent: safeAgentIdentifier(source.defaultAgent),
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
