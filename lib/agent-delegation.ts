import { authorizeAgentTool } from './agent-runtime.mjs';
import { formatTaskHandoff, normalizeTaskHandoff } from './task-handoff.mjs';
import type { AgentRunLedger } from './agent-run-ledger.ts';

interface DelegationAgent {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
}
interface DelegationRegistry {
  readonly agents: readonly DelegationAgent[];
  readonly policy?: { readonly maxDelegationDepth?: number; readonly maxParallelAgents?: number };
}
interface DelegationResult { readonly ok: boolean; readonly content?: unknown; readonly error?: unknown; }
interface DelegationLifecycle {
  readonly start: (input: {
    readonly runId: string; readonly parentRunId: string; readonly parentSignal?: AbortSignal | null;
    readonly execute: (input: { readonly signal?: AbortSignal }) => Promise<DelegationResult>;
  }) => { readonly promise: Promise<{ readonly value?: DelegationResult }>; readonly snapshot: () => { readonly state: string; readonly error?: unknown } };
}

function boundedPolicyInteger(value: unknown, fallback: number, max: number): number {
  return Number.isInteger(value) ? Math.min(Math.max(Number(value), 1), max) : fallback;
}
function cleanText(value: unknown, maxLength: number): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && text.length <= maxLength ? text : null;
}
function failed(error: string): { ok: false; error: string } { return { ok: false, error }; }
function countDelegations(runLedger: AgentRunLedger): number {
  const snapshot = runLedger.snapshot();
  return Array.isArray(snapshot?.entries) ? snapshot.entries.filter((entry) => entry?.action === 'agent.delegate').length : 0;
}
function prepareHandoff(args: unknown): Record<string, unknown> | null {
  const normalized = normalizeTaskHandoff(args);
  if (!normalized.ok) return null;
  const handoff = normalized.handoff;
  const structured = handoff.successCriteria.length || handoff.constraints.length || handoff.evidenceRequired.length;
  if (!structured) return handoff as unknown as Record<string, unknown>;
  const formatted = formatTaskHandoff(handoff);
  return formatted.ok ? { ...handoff, task: formatted.task } as unknown as Record<string, unknown> : null;
}
export function createAgentDelegator({
  registry, traceId, parentAgent, parentTaskId, runLedger, executeAgent, lifecycle = null, parentSignal = null
}: {
  readonly registry: DelegationRegistry; readonly traceId: unknown; readonly parentAgent: DelegationAgent;
  readonly parentTaskId: string; readonly runLedger: AgentRunLedger;
  readonly executeAgent: (input: { readonly agent: DelegationAgent; readonly task: string; readonly traceId: string; readonly depth: number; readonly parentTaskId: string; readonly signal?: AbortSignal }) => Promise<DelegationResult>;
  readonly lifecycle?: DelegationLifecycle | null; readonly parentSignal?: AbortSignal | null;
}): Readonly<{ delegate: (args: unknown, options?: { readonly depth?: number }) => Promise<{ ok: boolean; value?: unknown; error?: string }> }> {
  if (!registry?.agents?.length) throw new Error('INVALID_DELEGATION_RUNTIME:registry');
  if (!parentAgent?.id) throw new Error('INVALID_DELEGATION_RUNTIME:parentAgent');
  if (typeof traceId !== 'string' || !traceId.trim()) throw new Error('INVALID_DELEGATION_RUNTIME:traceId');
  if (!parentTaskId.trim()) throw new Error('INVALID_DELEGATION_RUNTIME:parentTaskId');
  if (!runLedger?.recordDelegationStart || !runLedger?.recordDelegationFinish || !runLedger?.snapshot) throw new Error('INVALID_DELEGATION_RUNTIME:runLedger');
  if (typeof executeAgent !== 'function') throw new Error('INVALID_DELEGATION_RUNTIME:executeAgent');
  const maxDepth = boundedPolicyInteger(registry.policy?.maxDelegationDepth, 1, 8);
  const maxFanOut = boundedPolicyInteger(registry.policy?.maxParallelAgents, 1, 16);

  async function delegate(args: unknown, { depth = 0 }: { readonly depth?: number } = {}) {
    const authorization = authorizeAgentTool(parentAgent, 'agent.delegate');
    if (!authorization.allowed) return failed('DELEGATION_NOT_AUTHORIZED');
    if (!Number.isInteger(depth) || depth < 0) return failed('INVALID_DELEGATION_DEPTH');
    if (depth >= maxDepth) return failed('DELEGATION_DEPTH_EXCEEDED');
    const handoff = prepareHandoff(args);
    if (!handoff) return failed('INVALID_DELEGATION_ARGUMENTS');
    const targetAgent = registry.agents.find((agent) => agent.id === String(handoff.agentId)) || null;
    if (!targetAgent) return failed('DELEGATION_TARGET_NOT_FOUND');
    if (targetAgent.id === parentAgent.id) return failed('SELF_DELEGATION_NOT_ALLOWED');
    if (targetAgent.kind !== 'specialist') return failed('DELEGATION_TARGET_NOT_SPECIALIST');
    if (countDelegations(runLedger) >= maxFanOut) return failed('DELEGATION_FANOUT_EXCEEDED');

    const delegationTask = runLedger.recordDelegationStart(targetAgent.id, { parentTaskId });
    let result: DelegationResult | undefined;
    try {
      if (lifecycle) {
        let lifecycleRun;
        try {
          lifecycleRun = lifecycle.start({
            runId: delegationTask.taskId,
            parentRunId: parentTaskId,
            parentSignal,
            execute: ({ signal }) => executeAgent({
              agent: targetAgent,
              task: String(handoff.task),
              traceId: String(traceId).trim(),
              depth: Number(depth) + 1,
              parentTaskId: delegationTask.taskId,
              signal
            })
          });
        } catch (error) {
          const code = error && typeof error === 'object' ? (error as Record<string, unknown>).code : undefined;
          if (code === 'AGENT_CONCURRENCY_EXCEEDED') throw new Error('DELEGATION_CONCURRENCY_EXCEEDED');
          throw error;
        }
        const completed = await lifecycleRun.promise;
        result = completed?.value;
        const state = lifecycleRun.snapshot().state;
        if (state === 'cancelled') result = failed('DELEGATION_CANCELLED');
        else if (!result) result = failed(String(lifecycleRun.snapshot().error || 'DELEGATED_AGENT_FAILED'));
      } else {
        result = await executeAgent({
          agent: targetAgent,
          task: String(handoff.task),
          traceId: String(traceId).trim(),
          depth: Number(depth) + 1,
          parentTaskId: delegationTask.taskId
        });
      }
    } catch {
      result = failed('DELEGATED_AGENT_FAILED');
    }
    if (!result?.ok) {
      const safeError = cleanText(result?.error, 120) || 'DELEGATED_AGENT_FAILED';
      runLedger.recordDelegationFinish(delegationTask.taskId, { ok: false, error: safeError });
      return failed(safeError);
    }
    runLedger.recordDelegationFinish(delegationTask.taskId, { ok: true });
    return {
      ok: true,
      value: {
        agentId: targetAgent.id,
        agentName: targetAgent.name,
        content: typeof result.content === 'string' ? result.content : ''
      }
    };
  }

  return Object.freeze({ delegate });
}