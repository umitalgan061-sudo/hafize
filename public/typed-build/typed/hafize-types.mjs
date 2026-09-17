export class HafizeApiError extends Error {
    code;
    status;
    traceId;
    retryable;
    constructor(message, options = {}) {
        super(message);
        this.name = 'HafizeApiError';
        this.code = options.code ?? 'API_ERROR';
        this.status = options.status ?? 0;
        this.traceId = options.traceId ?? null;
        this.retryable = options.retryable ?? false;
    }
}
export function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
export function stringValue(value, fallback = '') {
    return typeof value === 'string' ? value : fallback;
}
export function booleanValue(value, fallback = false) {
    return typeof value === 'boolean' ? value : fallback;
}
export function numberValue(value, fallback = 0) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
export function parseAgents(value) {
    const source = isRecord(value) ? value : {};
    const agents = Array.isArray(source.agents)
        ? source.agents.flatMap((raw) => {
            if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string')
                return [];
            const description = typeof raw.description === 'string' ? raw.description.slice(0, 320) : undefined;
            const tools = Array.isArray(raw.tools)
                ? raw.tools.filter((tool) => typeof tool === 'string').slice(0, 64)
                : undefined;
            return [{ id: raw.id.slice(0, 160), name: raw.name.slice(0, 160), ...(description ? { description } : {}), ...(tools ? { tools } : {}) }];
        })
        : [];
    return Object.freeze({
        defaultAgent: stringValue(source.defaultAgent).slice(0, 160),
        agents: Object.freeze(agents)
    });
}
export function parseModels(value) {
    const source = isRecord(value) ? value : {};
    const models = Array.isArray(source.models)
        ? source.models.filter((model) => typeof model === 'string' && model.length > 0).map((model) => model.slice(0, 240)).slice(0, 200)
        : [];
    return Object.freeze({ models: Object.freeze(models) });
}
export function parseHealth(value) {
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
export function connectivityFromHealth(health, networkOnline) {
    if (!networkOnline)
        return 'offline';
    if (!health)
        return 'unknown';
    if (health.status !== 'ok')
        return 'degraded';
    return health.nvidiaConfigured ? 'online' : 'degraded';
}
