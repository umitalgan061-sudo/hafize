const DEFAULT_COMPONENTS = Object.freeze(['auth', 'pwa', 'skills', 'memory', 'schedule', 'connectors', 'model']);
const STATUS = new Set(['ready', 'warning', 'blocked', 'unknown']);

function normalizeComponent(name) {
  const value = typeof name === 'string' ? name.trim().toLowerCase() : '';
  if (!DEFAULT_COMPONENTS.includes(value)) throw new Error('UNKNOWN_RUNTIME_COMPONENT');
  return value;
}

function normalizeStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : 'unknown';
  return STATUS.has(status) ? status : 'unknown';
}

export function normalizeReadinessReport(report = {}) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error('INVALID_RUNTIME_READINESS_REPORT');
  const components = {};
  for (const component of DEFAULT_COMPONENTS) {
    const raw = report[component];
    components[component] = Object.freeze({
      status: normalizeStatus(raw?.status),
      detail: typeof raw?.detail === 'string' ? raw.detail.trim().slice(0, 500) : '',
      checkedAt: typeof raw?.checkedAt === 'string' ? raw.checkedAt.trim().slice(0, 80) : ''
    });
  }
  return Object.freeze(components);
}

export function evaluateRuntimeReadiness(report = {}) {
  const components = normalizeReadinessReport(report);
  const blocked = DEFAULT_COMPONENTS.filter((name) => components[name].status === 'blocked');
  const warnings = DEFAULT_COMPONENTS.filter((name) => components[name].status === 'warning');
  const unknown = DEFAULT_COMPONENTS.filter((name) => components[name].status === 'unknown');
  return Object.freeze({
    // "ready" is the production gate, so a degraded component is not ready either.
    ready: blocked.length === 0 && unknown.length === 0 && warnings.length === 0,
    degraded: blocked.length === 0 && warnings.length > 0,
    blocked,
    warnings,
    unknown,
    components
  });
}

export function updateReadinessComponent(report, component, status, detail = '', checkedAt = '') {
  const name = normalizeComponent(component);
  const current = normalizeReadinessReport(report);
  return Object.freeze({
    ...current,
    [name]: Object.freeze({ status: normalizeStatus(status), detail: String(detail).slice(0, 500), checkedAt: String(checkedAt).slice(0, 80) })
  });
}

export const RUNTIME_READINESS_COMPONENTS = DEFAULT_COMPONENTS;
