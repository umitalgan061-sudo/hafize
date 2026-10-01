export type DeploymentState = 'ready' | 'degraded' | 'blocked' | 'unknown';
export interface DeploymentFinding { readonly code: string; readonly detail: string; }
export interface DeploymentComponent { readonly name: string; readonly state: DeploymentState; readonly findings: readonly DeploymentFinding[]; }
export interface DeploymentReadiness {
  readonly state: DeploymentState;
  readonly releaseable: boolean;
  readonly components: readonly DeploymentComponent[];
  readonly blockerCount: number;
  readonly degradedCount: number;
  readonly unknownCount: number;
}
const VALID_STATES = new Set<DeploymentState>(['ready', 'degraded', 'blocked', 'unknown']);
const cleanState = (value: unknown): string => typeof value === 'string' ? value.trim().toLowerCase() : 'unknown';
const finding = (code: unknown, detail = ''): Readonly<DeploymentFinding> => Object.freeze({ code: String(code || 'UNKNOWN_FINDING').slice(0, 120), detail: typeof detail === 'string' ? detail.slice(0, 160) : '' });

function normalizeComponent(name: string, value: unknown): DeploymentComponent {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const state = cleanState(source.state) as DeploymentState;
  if (!VALID_STATES.has(state)) return Object.freeze({ name, state: 'unknown', findings: Object.freeze([finding('INVALID_COMPONENT_STATE')]) });
  const rawFindings = Array.isArray(source.findings) ? source.findings : [];
  const findings = rawFindings.map((item) => {
    const value = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return finding(value.code, value.detail);
  });
  return Object.freeze({ name, state, findings: Object.freeze(findings) });
}
export function evaluateDeploymentReadiness(input: { runtime?: unknown; config?: unknown; release?: unknown; requiredComponents?: readonly string[] } = {}): DeploymentReadiness {
  const required = input.requiredComponents ?? ['runtime', 'config', 'release'];
  if (!Array.isArray(required) || !required.length) throw new Error('INVALID_DEPLOYMENT_REQUIRED_COMPONENTS');
  const names: string[] = [];
  const seen = new Set<string>();
  for (const raw of required) {
    const name = typeof raw === 'string' ? raw.trim() : '';
    if (!name) throw new Error('INVALID_DEPLOYMENT_COMPONENT_NAME');
    if (seen.has(name)) throw new Error('DUPLICATE_DEPLOYMENT_COMPONENT:' + name);
    seen.add(name); names.push(name);
  }
  const source: Record<string, unknown> = { runtime: input.runtime, config: input.config, release: input.release };
  const components = names.map((name) => normalizeComponent(name, source[name]));
  const blocked = components.filter((item) => item.state === 'blocked');
  const degraded = components.filter((item) => item.state === 'degraded');
  const unknown = components.filter((item) => item.state === 'unknown');
  const state: DeploymentState = blocked.length ? 'blocked' : unknown.length ? 'unknown' : degraded.length ? 'degraded' : 'ready';
  return Object.freeze({ state, releaseable: state === 'ready', components: Object.freeze(components), blockerCount: blocked.length, degradedCount: degraded.length, unknownCount: unknown.length });
}
export function assertDeploymentReleaseable(report: DeploymentReadiness): DeploymentReadiness {
  if (!report || report.releaseable !== true || report.state !== 'ready') throw new Error('DEPLOYMENT_NOT_RELEASEABLE');
  return report;
}
export function summarizeDeploymentReadiness(report: DeploymentReadiness): string {
  if (!report || !Array.isArray(report.components)) return 'deployment:unknown';
  return report.components.map((component) => component.name + ':' + component.state).join(',');
}
export const DEPLOYMENT_READINESS_STATES = Object.freeze([...VALID_STATES]);
