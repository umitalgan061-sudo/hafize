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
  const components: Record<string, 'ready' | 'warning' | 'blocked' | 'unknown'> = {
    auth: !config.authRequired || !config.findings.some((finding) => finding.code === 'AUTH_SECRET_MISSING') ? 'ready' : 'blocked',
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
  const state: SystemState = summary.blocked > 0 ? 'blocked' : summary.unknown > 0 ? 'unknown' : summary.warning > 0 ? 'degraded' : deployment.state;
  const releaseable = deployment.releaseable && summary.blocked === 0 && summary.unknown === 0 && summary.warning === 0 && input.releaseChecksPass !== false;
  return Object.freeze({ state, releaseable, config, runtime, deployment, components: Object.freeze(components), summary: Object.freeze(summary) });
}
