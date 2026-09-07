import { createTaskLedger } from './task-ledger.mjs';
import { createTraceContext, normalizeTaskRelation, assertTraceContinuity } from './trace-consistency.mjs';

export function createAgentRunLedger({ traceId, agentId, action = 'agent.run', now } = {}) {
  const context = createTraceContext(traceId);
  const ledger = createTaskLedger({ traceId: context.traceId, now });
  const root = ledger.add({ agentId, action, status: 'running' });

  function recordToolStart(toolName, { parentTaskId = root.taskId, toolAgentId = agentId } = {}) {
    const relation = normalizeTaskRelation({ traceId: context.traceId, taskId: `${root.taskId}:tool:${String(toolName).replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 80)}`, parentTaskId });
    const entry = ledger.add({ agentId: toolAgentId, action: `tool:${toolName}`, status: 'running', parentTaskId: relation.parentTaskId });
    assertTraceContinuity(context.traceId, context.traceId);
    return entry;
  }

  function recordToolFinish(taskId, result) {
    const ok = Boolean(result?.ok);
    return ledger.update(taskId, { status: ok ? 'completed' : 'failed', detail: ok ? 'ok' : String(result?.error || 'TOOL_EXECUTION_FAILED').slice(0, 120) });
  }

  function recordDelegationStart(targetAgentId, { parentTaskId = root.taskId } = {}) {
    return ledger.add({ agentId: targetAgentId, action: 'agent.delegate', status: 'running', parentTaskId });
  }

  function recordDelegationFinish(taskId, result) {
    const ok = Boolean(result?.ok);
    return ledger.update(taskId, { status: ok ? 'completed' : 'failed', detail: ok ? 'ok' : String(result?.error || 'DELEGATED_AGENT_FAILED').slice(0, 120) });
  }

  function finish({ ok = true, detail = null } = {}) {
    return ledger.update(root.taskId, { status: ok ? 'completed' : 'failed', detail: detail == null ? null : String(detail).slice(0, 120) });
  }

  return Object.freeze({
    rootTaskId: root.taskId,
    traceId: context.traceId,
    recordToolStart,
    recordToolFinish,
    recordDelegationStart,
    recordDelegationFinish,
    finish,
    snapshot: ledger.snapshot
  });
}
