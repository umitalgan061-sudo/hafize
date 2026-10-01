const DEFAULT_COMPONENTS = Object.freeze(['auth', 'pwa', 'skills', 'memory', 'schedule', 'connectors', 'model'] as const);
const STATUS = new Set(['ready', 'warning', 'blocked', 'unknown'] as const);
export type RuntimeComponent = typeof DEFAULT_COMPONENTS[number];
export type RuntimeStatus = 'ready' | 'warning' | 'blocked' | 'unknown';
export interface RuntimeComponentState { readonly status: RuntimeStatus; readonly detail: string; readonly checkedAt: string; }
export type RuntimeReadinessReport = Readonly<Record<RuntimeComponent, RuntimeComponentState>>;
export interface RuntimeReadinessEvaluation {
  readonly ready: boolean;
  readonly degraded: boolean;
  readonly blocked: readonly RuntimeComponent[];
  readonly warnings: readonly RuntimeComponent[];
  readonly unknown: readonly RuntimeComponent[];
  readonly components: RuntimeReadinessReport;
}
const normalizeComponent = (name: unknown): RuntimeComponent => {
  const value = typeof name === 'string' ? name.trim().toLowerCase() : '';
  if (!DEFAULT_COMPONENTS.includes(value as RuntimeComponent)) throw new Error('UNKNOWN_RUNTIME_COMPONENT');
  return value as RuntimeComponent;
};
const normalizeStatus = (value: unknown): RuntimeStatus => {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : 'unknown';
  return STATUS.has(status as RuntimeStatus) ? status as RuntimeStatus : 'unknown';
};
export function normalizeReadinessReport(report: Record<string, unknown> = {}): RuntimeReadinessReport {
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error('INVALID_RUNTIME_READINESS_REPORT');
  const components = {} as Record<RuntimeComponent, RuntimeComponentState>;
  for (const component of DEFAULT_COMPONENTS) {
    const raw = report[component];
    const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    components[component] = Object.freeze({
      status: normalizeStatus(value.status),
      detail: typeof value.detail === 'string' ? value.detail.trim().slice(0, 500) : '',
      checkedAt: typeof value.checkedAt === 'string' ? value.checkedAt.trim().slice(0, 80) : ''
    });
  }
  return Object.freeze(components);
}
export function evaluateRuntimeReadiness(report: Record<string, unknown> | RuntimeReadinessReport = {}): RuntimeReadinessEvaluation {
  const components = normalizeReadinessReport(report as Record<string, unknown>);
  const blocked = DEFAULT_COMPONENTS.filter((name) => components[name].status === 'blocked');
  const warnings = DEFAULT_COMPONENTS.filter((name) => components[name].status === 'warning');
  const unknown = DEFAULT_COMPONENTS.filter((name) => components[name].status === 'unknown');
  return Object.freeze({
    ready: blocked.length === 0 && unknown.length === 0 && warnings.length === 0,
    degraded: blocked.length === 0 && warnings.length > 0,
    blocked,
    warnings,
    unknown,
    components
  });
}
export function updateReadinessComponent(report: Record<string, unknown> | RuntimeReadinessReport, component: RuntimeComponent, status: RuntimeStatus, detail = '', checkedAt = ''): RuntimeReadinessReport {
  const name = normalizeComponent(component);
  const current = normalizeReadinessReport(report as Record<string, unknown>);
  return Object.freeze({ ...current, [name]: Object.freeze({ status: normalizeStatus(status), detail: String(detail).slice(0, 500), checkedAt: String(checkedAt).slice(0, 80) }) });
}
export const RUNTIME_READINESS_COMPONENTS = DEFAULT_COMPONENTS;
