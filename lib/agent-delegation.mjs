import { authorizeAgentTool } from './agent-runtime.mjs';
import { createDelegationLifecycle } from './delegation-lifecycle.mjs';
import { normalizeDelegatedAgentResult } from './delegated-agent-result-policy.mjs';
import { formatTaskHandoff, normalizeTaskHandoff } from './task-handoff.mjs';

function boundedPolicyInteger(value, fallback, max) {
  return Number.isInteger(value) ? Math.min(Math.max(value, 1), max) : fallback;
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
  parentSignal = null,
  runLedger,
  executeAgent
} = {}) {
  if (!registry || !Array.isArray(registry.agents)) throw new Error('INVALID_DELEGATION_RUNTIME:registry');
  if (!parentAgent?.id) throw new Error('INVALID_DELEGATION_RUNTIME:parentAgent');
  if (typeof traceId !== 'string' || !traceId.trim()) throw new Error('INVALID_DELEGATION_RUNTIME:traceId');
  if (typeof parentTaskId !== 'string' || !parentTaskId.trim()) throw new Error('INVALID_DELEGATION_RUNTIME:parentTaskId');
  if (
    typeof runLedger?.recordDelegationStart !== 'function'
    || typeof runLedger?.recordDelegationFinish !== 'function'
    || typeof runLedger?.snapshot !== 'function'
  ) {
    throw new Error('INVALID_DELEGATION_RUNTIME:runLedger');
  }
  if (typeof executeAgent !== 'function') throw new Error('INVALID_DELEGATION_RUNTIME:executeAgent');

  const maxDepth = boundedPolicyInteger(registry.policy?.maxDelegationDepth, 1, 8);
  const maxParallelAgents = boundedPolicyInteger(registry.policy?.maxParallelAgents, 1, 16);
  const lifecycle = createDelegationLifecycle({ maxParallelAgents, parentSignal });

  async function delegate(args, { depth = 0, signal = null } = {}) {
    const authorization = authorizeAgentTool(parentAgent, 'agent.delegate');
    if (!authorization.allowed) return failed('DELEGATION_NOT_AUTHORIZED');
    if (!Number.isInteger(depth) || depth < 0) return failed('INVALID_DELEGATION_DEPTH');
    if (depth >= maxDepth) return failed('DELEGATION_DEPTH_EXCEEDED');

    const handoff = prepareHandoff(args);
    if (!handoff) return failed('INVALID_DELEGATION_ARGUMENTS');
    const targetAgentId = handoff.agentId;
    const task = handoff.task;

    const targetAgent = registry.agents.find((agent) => agent.id === targetAgentId) || null;
    if (!targetAgent) return failed('DELEGATION_TARGET_NOT_FOUND');
    if (targetAgent.id === parentAgent.id) return failed('SELF_DELEGATION_NOT_ALLOWED');
    if (targetAgent.kind !== 'specialist') return failed('DELEGATION_TARGET_NOT_SPECIALIST');

    const delegationTask = runLedger.recordDelegationStart(targetAgent.id, { parentTaskId });
    const lease = lifecycle.acquire(delegationTask.taskId, { signal });
    if (!lease.ok) {
      runLedger.recordDelegationFinish(delegationTask.taskId, {
        ok: false,
        blocked: true,
        error: lease.error
      });
      return failed(lease.error);
    }

    let normalized;
    try {
      const rawResult = await executeAgent({
        agent: targetAgent,
        task,
        traceId: traceId.trim(),
        depth: depth + 1,
        parentTaskId: delegationTask.taskId,
        signal: lease.signal
      });
      if (lease.signal.aborted) {
        normalized = { ok: true, result: failed('DELEGATION_CANCELLED') };
      } else {
        normalized = normalizeDelegatedAgentResult(rawResult);
      }
    } catch {
      normalized = {
        ok: true,
        result: failed(lease.signal.aborted ? 'DELEGATION_CANCELLED' : 'DELEGATED_AGENT_FAILED')
      };
    } finally {
      lease.release();
    }

    const result = normalized?.ok === true
      ? normalized.result
      : failed('DELEGATED_RESULT_INVALID');

    if (!result.ok) {
      runLedger.recordDelegationFinish(delegationTask.taskId, {
        ok: false,
        blocked: result.error === 'DELEGATION_CANCELLED',
        error: result.error
      });
      return failed(result.error);
    }

    runLedger.recordDelegationFinish(delegationTask.taskId, { ok: true });
    return {
      ok: true,
      value: {
        agentId: targetAgent.id,
        agentName: targetAgent.name,
        content: result.content
      }
    };
  }

  return Object.freeze({
    delegate,
    cancel: lifecycle.cancel,
    cancelAll: lifecycle.cancelAll,
    lifecycleSnapshot: lifecycle.snapshot
  });
}
