import { authorizeAgentTool, type AgentDefinition } from './agent-runtime.ts';
import { formatTaskHandoff, normalizeTaskHandoff, type TaskHandoff } from './task-handoff.ts';

interface RegistryPolicy { readonly maxDelegationDepth?: number; readonly maxParallelAgents?: number; }
interface Registry { readonly agents: readonly AgentDefinition[]; readonly policy?: RegistryPolicy; }
interface RunLedger {
  readonly recordDelegationStart: (agentId: string, options?: { readonly parentTaskId?: string }) => { readonly taskId: string };
  readonly recordDelegationFinish: (taskId: string, result: { readonly ok: boolean; readonly error?: string }) => unknown;
  readonly snapshot: () => { readonly entries?: readonly { readonly action?: string }[] };
}
interface LifecycleRun { readonly promise: Promise<{ readonly value?: unknown }>; readonly snapshot: () => { readonly state?: string; readonly error?: string } }
interface Lifecycle {
  readonly start: (options: { readonly runId: string; readonly parentRunId: string; readonly parentSignal: AbortSignal | null; readonly execute: (input: { readonly signal: AbortSignal }) => Promise<unknown> }) => LifecycleRun;
}
interface ExecuteResult { readonly ok?: boolean; readonly error?: unknown; readonly content?: unknown; }
interface ExecuteAgent { readonly (input: { readonly agent: AgentDefinition; readonly task: string; readonly traceId: string; readonly depth: number; readonly parentTaskId: string; readonly signal?: AbortSignal | null }): Promise<ExecuteResult>; }

type DelegationResult =
  | { readonly ok: false; readonly error: string }
  | { readonly ok: true; readonly value: { readonly agentId: string; readonly agentName: string; readonly content: string } };

const boundedPolicyInteger = (value: unknown, fallback: number, max: number): number => Number.isInteger(value) ? Math.min(Math.max(Number(value), 1), max) : fallback;
const cleanText = (value: unknown, maxLength: number): string | null => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && text.length <= maxLength ? text : null;
};
const failed = (error: string): DelegationResult => ({ ok: false, error });
const countDelegations = (runLedger: RunLedger): number => {
  const entries = runLedger.snapshot()?.entries;
  return Array.isArray(entries) ? entries.filter((entry) => entry?.action === 'agent.delegate').length : 0;
};

function prepareHandoff(args: unknown): TaskHandoff | null {
  const normalized = normalizeTaskHandoff(args);
  if (!normalized.ok) return null;
  const handoff = normalized.handoff;
  const structured = handoff.successCriteria.length || handoff.constraints.length || handoff.evidenceRequired.length;
  if (!structured) return handoff;
  const formatted = formatTaskHandoff(handoff);
  return formatted.ok ? { ...handoff, task: formatted.task } : null;
}

export interface AgentDelegator {
  readonly delegate: (args: unknown, options?: { readonly depth?: number }) => Promise<DelegationResult>;
}

export function createAgentDelegator(options: {
  readonly registry?: Registry;
  readonly traceId?: unknown;
  readonly parentAgent?: AgentDefinition;
  readonly parentTaskId?: unknown;
  readonly runLedger?: RunLedger;
  readonly executeAgent?: ExecuteAgent;
  readonly lifecycle?: Lifecycle | null;
  readonly parentSignal?: AbortSignal | null;
} = {}): AgentDelegator {
  const { registry, traceId, parentAgent, parentTaskId, runLedger, executeAgent, lifecycle = null, parentSignal = null } = options;
  if (!registry || !Array.isArray(registry.agents)) throw new Error('INVALID_DELEGATION_RUNTIME:registry');
  if (!parentAgent?.id) throw new Error('INVALID_DELEGATION_RUNTIME:parentAgent');
  if (typeof traceId !== 'string' || !traceId.trim()) throw new Error('INVALID_DELEGATION_RUNTIME:traceId');
  if (typeof parentTaskId !== 'string' || !parentTaskId.trim()) throw new Error('INVALID_DELEGATION_RUNTIME:parentTaskId');
  if (!runLedger || typeof runLedger.recordDelegationStart !== 'function' || typeof runLedger.recordDelegationFinish !== 'function' || typeof runLedger.snapshot !== 'function') throw new Error('INVALID_DELEGATION_RUNTIME:runLedger');
  if (typeof executeAgent !== 'function') throw new Error('INVALID_DELEGATION_RUNTIME:executeAgent');
  if (lifecycle !== null && typeof lifecycle.start !== 'function') throw new Error('INVALID_DELEGATION_RUNTIME:lifecycle');
  if (parentSignal !== null && typeof parentSignal.addEventListener !== 'function') throw new Error('INVALID_DELEGATION_RUNTIME:parentSignal');

  const maxDepth = boundedPolicyInteger(registry.policy?.maxDelegationDepth, 1, 8);
  const maxFanOut = boundedPolicyInteger(registry.policy?.maxParallelAgents, 1, 16);

  async function delegate(args: unknown, { depth = 0 }: { readonly depth?: number } = {}): Promise<DelegationResult> {
    if (!authorizeAgentTool(parentAgent, 'agent.delegate').allowed) return failed('DELEGATION_NOT_AUTHORIZED');
    if (!Number.isInteger(depth) || depth < 0) return failed('INVALID_DELEGATION_DEPTH');
    if (depth >= maxDepth) return failed('DELEGATION_DEPTH_EXCEEDED');
    const handoff = prepareHandoff(args);
    if (!handoff) return failed('INVALID_DELEGATION_ARGUMENTS');
    const targetAgent = registry.agents.find((agent) => agent.id === handoff.agentId) || null;
    if (!targetAgent) return failed('DELEGATION_TARGET_NOT_FOUND');
    if (targetAgent.id === parentAgent.id) return failed('SELF_DELEGATION_NOT_ALLOWED');
    if (targetAgent.kind !== 'specialist') return failed('DELEGATION_TARGET_NOT_SPECIALIST');
    if (countDelegations(runLedger) >= maxFanOut) return failed('DELEGATION_FANOUT_EXCEEDED');

    const delegationTask = runLedger.recordDelegationStart(targetAgent.id, { parentTaskId: String(parentTaskId) });
    let result: ExecuteResult | null = null;
    try {
      if (lifecycle) {
        let lifecycleRun: LifecycleRun;
        try {
          lifecycleRun = lifecycle.start({
            runId: delegationTask.taskId,
            parentRunId: String(parentTaskId),
            parentSignal,
            execute: ({ signal }) => executeAgent({ agent: targetAgent, task: handoff.task, traceId: String(traceId).trim(), depth: depth + 1, parentTaskId: delegationTask.taskId, signal })
          });
        } catch (error) {
          if (error instanceof Error && 'code' in error && String(error.code) === 'AGENT_CONCURRENCY_EXCEEDED') {
            const failure = new Error('DELEGATION_CONCURRENCY_EXCEEDED');
            Object.assign(failure, { code: 'DELEGATION_CONCURRENCY_EXCEEDED' });
            throw failure;
          }
          throw error;
        }
        const completed = await lifecycleRun.promise;
        result = (completed?.value as ExecuteResult | undefined) || null;
        const state = lifecycleRun.snapshot().state;
        if (state === 'cancelled') result = { ok: false, error: 'DELEGATION_CANCELLED' };
        else if (!result) result = { ok: false, error: lifecycleRun.snapshot().error || 'DELEGATED_AGENT_FAILED' };
      } else {
        result = await executeAgent({ agent: targetAgent, task: handoff.task, traceId: String(traceId).trim(), depth: depth + 1, parentTaskId: delegationTask.taskId, signal: parentSignal });
      }
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : '';
      result = { ok: false, error: code === 'DELEGATION_CONCURRENCY_EXCEEDED' ? code : 'DELEGATED_AGENT_FAILED' };
    }

    if (!result?.ok) {
      const safeError = cleanText(result?.error, 120) || 'DELEGATED_AGENT_FAILED';
      runLedger.recordDelegationFinish(delegationTask.taskId, { ok: false, error: safeError });
      return failed(safeError);
    }
    runLedger.recordDelegationFinish(delegationTask.taskId, { ok: true });
    return { ok: true, value: { agentId: targetAgent.id, agentName: targetAgent.name, content: typeof result.content === 'string' ? result.content : '' } };
  }

  return Object.freeze({ delegate });
}
