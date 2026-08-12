import { authorizeAgentTool } from './agent-runtime.mjs';

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

function countDelegations(runLedger) {
  const snapshot = runLedger.snapshot();
  return Array.isArray(snapshot?.entries)
    ? snapshot.entries.filter((entry) => entry?.action === 'agent.delegate').length
    : 0;
}

export function createAgentDelegator({
  registry,
  traceId,
  parentAgent,
  parentTaskId,
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
  const maxFanOut = boundedPolicyInteger(registry.policy?.maxParallelAgents, 1, 16);

  async function delegate(args, { depth = 0 } = {}) {
    const authorization = authorizeAgentTool(parentAgent, 'agent.delegate');
    if (!authorization.allowed) return failed('DELEGATION_NOT_AUTHORIZED');
    if (!Number.isInteger(depth) || depth < 0) return failed('INVALID_DELEGATION_DEPTH');
    if (depth >= maxDepth) return failed('DELEGATION_DEPTH_EXCEEDED');

    const targetAgentId = cleanText(args?.agentId, 120);
    const task = cleanText(args?.task, 20000);
    if (!targetAgentId || !task) return failed('INVALID_DELEGATION_ARGUMENTS');

    const targetAgent = registry.agents.find((agent) => agent.id === targetAgentId) || null;
    if (!targetAgent) return failed('DELEGATION_TARGET_NOT_FOUND');
    if (targetAgent.id === parentAgent.id) return failed('SELF_DELEGATION_NOT_ALLOWED');
    if (targetAgent.kind !== 'specialist') return failed('DELEGATION_TARGET_NOT_SPECIALIST');
    if (countDelegations(runLedger) >= maxFanOut) return failed('DELEGATION_FANOUT_EXCEEDED');

    const delegationTask = runLedger.recordDelegationStart(targetAgent.id, { parentTaskId });
    let result;
    try {
      result = await executeAgent({
        agent: targetAgent,
        task,
        traceId: traceId.trim(),
        depth: depth + 1,
        parentTaskId: delegationTask.taskId
      });
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
