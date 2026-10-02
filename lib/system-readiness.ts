import { evaluateConfigReadiness, type ConfigEnv } from './config-readiness.ts';
import { evaluateDeploymentReadiness } from './deployment-readiness.ts';
import { evaluateRuntimeReadiness } from './runtime-readiness.ts';

export type SystemState = 'ready' | 'degraded' | 'blocked' | 'unknown';
export interface SystemReadinessInput {
  readonly env?: ConfigEnv;
  readonly runtime: Record<string, unknown>;
  readonly pwaReady?: boolean;
  readonly releaseReady?: boolean;
  readonly releaseChecksPass?: boolean;
}
export interface SystemReadinessReport {
  readonly state: SystemState;
  readonly releaseable: boolean;
  readonly config: ReturnType<typeof evaluateConfigReadiness>;
  readonly runtime: ReturnType<typeof evaluateRuntimeReadiness>;
  readonly deployment: ReturnType<typeof evaluateDeploymentReadiness>;
  readonly components: Readonly<Record<string, 'ready' | 'warning' | 'blocked' | 'unknown'>>;
  readonly summary: Readonly<{ total: number; ready: number; warning: number; blocked: number; unknown: number }>;
}

const SYSTEM_STATE_SEVERITY: Readonly<Record<SystemState, number>> = Object.freeze({
  ready: 0,
  degraded: 1,
  unknown: 2,
  blocked: 3
});

export function buildSystemReadiness(input: SystemReadinessInput): SystemReadinessReport {
  const config = evaluateConfigReadiness(input.env);
  const runtime = evaluateRuntimeReadiness(input.runtime);
  const pwa = input.pwaReady === true ? 'ready' : 'unknown';
  const release = input.releaseReady === true ? 'ready' : input.releaseReady === false ? 'blocked' : 'unknown';
  const deployment = evaluateDeploymentReadiness({
    runtime: { state: runtime.ready ? 'ready' : runtime.blocked.length ? 'blocked' : runtime.unknown.length ? 'unknown' : 'degraded' },
    config: { state: config.state },
    release: { state: release }
  });
  // Auth is blocked only when a required secret is actually missing or the env
  // itself is unusable. A loopback development host simply does not require a
  // session secret, which is a healthy configuration rather than a blocker.
  const authBlocked = config.findings.some((finding) => finding.code === 'AUTH_SECRET_MISSING' || finding.code === 'INVALID_ENV');
  const authWarning = !authBlocked && config.findings.length > 0;
  const components: Record<string, 'ready' | 'warning' | 'blocked' | 'unknown'> = {
    auth: authBlocked ? 'blocked' : authWarning ? 'warning' : 'ready',
    pwa,
    skills: runtime.components.skills.status === 'ready' ? 'ready' : runtime.components.skills.status === 'warning' ? 'warning' : runtime.components.skills.status,
    memory: runtime.components.memory.status === 'ready' ? 'ready' : runtime.components.memory.status === 'warning' ? 'warning' : runtime.components.memory.status,
    schedule: runtime.components.schedule.status === 'ready' ? 'ready' : runtime.components.schedule.status === 'warning' ? 'warning' : runtime.components.schedule.status,
    connectors: runtime.components.connectors.status === 'ready' ? 'ready' : runtime.components.connectors.status === 'warning' ? 'warning' : runtime.components.connectors.status,
    model: runtime.components.model.status === 'ready' ? 'ready' : runtime.components.model.status === 'warning' ? 'warning' : runtime.components.model.status,
    release
  };
  const values = Object.values(components);
  const summary = {
    total: values.length,
    ready: values.filter((value) => value === 'ready').length,
    warning: values.filter((value) => value === 'warning').length,
    blocked: values.filter((value) => value === 'blocked').length,
    unknown: values.filter((value) => value === 'unknown').length
  };
  // The reported state can never be better than the worst component, so an
  // unknown surface is never rounded up to ready.
  const componentState: SystemState = summary.blocked ? 'blocked' : summary.unknown ? 'unknown' : summary.warning ? 'degraded' : 'ready';
  const deploymentState: SystemState = deployment.state === 'blocked' ? 'blocked' : deployment.state === 'unknown' ? 'unknown' : deployment.state === 'degraded' ? 'degraded' : 'ready';
  const state: SystemState = SYSTEM_STATE_SEVERITY[componentState] >= SYSTEM_STATE_SEVERITY[deploymentState] ? componentState : deploymentState;
  return Object.freeze({
    state,
    releaseable: deployment.releaseable && input.releaseChecksPass !== false && state === 'ready',
    config,
    runtime,
    deployment,
    components: Object.freeze(components),
    summary: Object.freeze(summary)
  });
}
