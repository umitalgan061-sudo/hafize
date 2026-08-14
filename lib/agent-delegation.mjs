import { authorizeAgentTool } from './agent-runtime.mjs';
import { formatTaskHandoff, normalizeTaskHandoff } from './task-handoff.mjs';

function boundedPolicyInteger(value, fallback, max) {
  return Number.isInteger(value) ? Math.min(Math.max(value, 1), max) : fallback;
}

function cleanText(value, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && text.length <= maxLength ? text : null;
}

function failed(error) {
  return { ok: false, error };
}

function prepareHandoff(args) {
  const normalized = normalizeTaskHandoff(args);
  if (!normalized.ok) return null;
  const handoff = normalized.handoff;
  const structured = handoff.successCriteria.length
    || handoff.constraints.length
    || handoff.evidenceRequired.length;
  if (!structured) return handoff;

  const formatted = formatTaskHandoff(handoff);
  if (!formatted.ok) return null;
  return { ...handoff, task: formatted.task };
}

export function createAgentDelegator({
  registry,
  traceId,
  parentAgent,
  parentTaskId,
  runLedger,
  executeAgent,
  signal
} = {}) {
  if (!registry || !Array.isArray(registry.agents)) throw new Error('INVALID_DELEGATION_RUNTIME:registry');
  if (!parentAgent?.id) throw new Error('INVALID_DELEGATION_RUNTIME:parentAgent');
  if (typeof traceId !== 'string' || !traceId.trim()) throw new Error('INVALID_DELEGATION_RUNTIME:traceId');
  if (typeof parentTaskId !== 'string' || !parentTaskId.trim()) throw new Error('INVALID_DELEGATION_RUNTIME:parentTaskId');
  if (
    typeof runLedger?.recordDelegationStart !== 'function'
    || typeof runLedger?.recordDelegationFinish !== 'function'
  ) {
    throw new Error('INVALID_DELEGATION_RUNTIME:runLedger');
  }
  if (typeof executeAgent !== 'function') throw new Error('INVALID_DELEGATION_RUNTIME:executeAgent');
  if (signal != null && !(signal instanceof AbortSignal)) throw new Error('INVALID_DELEGATION_RUNTIME:signal');

  const maxDepth = boundedPolicyInteger(registry.policy?.maxDelegationDepth, 1, 8);
  const maxParallel = boundedPolicyInteger(registry.policy?.maxParallelAgents, 1, 16);
  let activeDelegations = 0;
  let cancelled = Boolean(signal?.aborted);
  signal?.addEventListener('abort', () => { cancelled = true; }, { once: true });

  async function delegate(args, { depth = 0 } = {}) {
    const authorization = authorizeAgentTool(parentAgent, 'agent.delegate');
    if (!authorization.allowed) return failed('DELEGATION_NOT_AUTHORIZED');
    if (cancelled || signal?.aborted) return failed('DELEGATION_CANCELLED');
    if (!Number.isInteger(depth) || depth < 0) return failed('INVALID_DELEGATION_DEPTH');
    if (depth >= maxDepth) return failed('DELEGATION_DEPTH_EXCEEDED');

    const handoff = prepareHandoff(args);
    if (!handoff) return failed('INVALID_DELEGATION_ARGUMENTS');
    const targetAgent = registry.agents.find((agent) => agent.id === handoff.agentId) || null;
    if (!targetAgent) return failed('DELEGATION_TARGET_NOT_FOUND');
    if (targetAgent.id === parentAgent.id) return failed('SELF_DELEGATION_NOT_ALLOWED');
    if (targetAgent.kind !== 'specialist') return failed('DELEGATION_TARGET_NOT_SPECIALIST');
    if (activeDelegations >= maxParallel) return failed('DELEGATION_CONCURRENCY_EXCEEDED');

    const delegationTask = runLedger.recordDelegationStart(targetAgent.id, { parentTaskId });
    activeDelegations += 1;
    let result;
    try {
      result = await executeAgent({
        agent: targetAgent,
        task: handoff.task,
        traceId: traceId.trim(),
        depth: depth + 1,
        parentTaskId: delegationTask.taskId,
        signal
      });
      if (cancelled || signal?.aborted) result = failed('DELEGATION_CANCELLED');
    } catch (error) {
      const aborted = error?.name === 'AbortError' || cancelled || signal?.aborted;
      result = failed(aborted ? 'DELEGATION_CANCELLED' : 'DELEGATED_AGENT_FAILED');
    } finally {
      activeDelegations -= 1;
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

  function cancel() {
    cancelled = true;
  }

  function status() {
    return Object.freeze({ cancelled, activeDelegations, maxParallel });
  }

  return Object.freeze({ delegate, cancel, status });
}
