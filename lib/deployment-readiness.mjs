function cleanState(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : 'unknown';
}

function finding(code, detail = '') {
  return Object.freeze({ code, detail: typeof detail === 'string' ? detail.slice(0, 160) : '' });
}

const VALID_STATES = new Set(['ready', 'degraded', 'blocked', 'unknown']);

function normalizeComponent(name, value) {
  const state = cleanState(value?.state);
  if (!VALID_STATES.has(state)) return Object.freeze({ name, state: 'unknown', findings: Object.freeze([finding('INVALID_COMPONENT_STATE')]) });
  const findings = Array.isArray(value?.findings)
    ? value.findings.map((item) => finding(String(item?.code || 'UNKNOWN_FINDING'), String(item?.detail || '')))
    : [];
  return Object.freeze({ name, state, findings: Object.freeze(findings) });
}

export function evaluateDeploymentReadiness({ runtime, config, release, requiredComponents = ['runtime', 'config', 'release'] } = {}) {
  if (!Array.isArray(requiredComponents) || !requiredComponents.length) throw new Error('INVALID_DEPLOYMENT_REQUIRED_COMPONENTS');

  const names = [];
  const seen = new Set();
  for (const item of requiredComponents) {
    const name = typeof item === 'string' ? item.trim() : '';
    if (!name) throw new Error('INVALID_DEPLOYMENT_COMPONENT_NAME');
    if (seen.has(name)) throw new Error(`DUPLICATE_DEPLOYMENT_COMPONENT:${name}`);
    seen.add(name);
    names.push(name);
  }

  const source = { runtime, config, release };
  const components = names.map((name) => normalizeComponent(name, source[name]));
  const blocked = components.filter((item) => item.state === 'blocked');
  const degraded = components.filter((item) => item.state === 'degraded');
  const unknown = components.filter((item) => item.state === 'unknown');
  const state = blocked.length ? 'blocked' : unknown.length ? 'unknown' : degraded.length ? 'degraded' : 'ready';

  return Object.freeze({
    state,
    releaseable: state === 'ready',
    components: Object.freeze(components),
    blockerCount: blocked.length,
    degradedCount: degraded.length,
    unknownCount: unknown.length
  });
}

export function assertDeploymentReleaseable(report) {
  if (!report || report.releaseable !== true || report.state !== 'ready') throw new Error('DEPLOYMENT_NOT_RELEASEABLE');
  return report;
}

export function summarizeDeploymentReadiness(report) {
  if (!report || !Array.isArray(report.components)) return 'deployment:unknown';
  return report.components.map((component) => `${component.name}:${component.state}`).join(',');
}

export const DEPLOYMENT_READINESS_STATES = Object.freeze([...VALID_STATES]);
