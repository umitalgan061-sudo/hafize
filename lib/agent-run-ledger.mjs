import { createTaskLedger } from './task-ledger.mjs';
import { createTraceContext, normalizeTaskRelation, assertTraceContinuity } from './trace-consistency.mjs';

/**
 * Tek bir ajan çalışmasını, araç çağrılarını ve delegasyonlarını izleyen defter.
 *
 * @param {{ traceId?: string; agentId?: string; action?: string; now?: () => Date }} [options]
 */
export function createAgentRunLedger({ traceId, agentId, action = 'agent.run', now } = {}) {
  const context = createTraceContext(traceId);
  const ledger = createTaskLedger({ traceId: context.traceId, now });
  const root = ledger.add({ agentId, action, status: 'running' });

  /**
   * @param {string} parentTaskId
   * @returns {import('./task-ledger.mjs').TaskLedgerEntry}
   */
  function resolveParent(parentTaskId) {
    const parent = ledger.read(parentTaskId);
    if (!parent) throw new Error('TASK_PARENT_NOT_FOUND');
    assertTraceContinuity(context.traceId, parent.traceId);
    return parent;
  }

  /**
   * @param {string} toolName
   * @param {{ parentTaskId?: string; toolAgentId?: string }} [options]
   */
  function recordToolStart(toolName, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('INVALID_TOOL_TASK_OPTIONS');
    const { parentTaskId = root.taskId, toolAgentId = agentId } = options;
    const parent = resolveParent(parentTaskId);
    const relation = normalizeTaskRelation({ traceId: context.traceId, taskId: `${root.taskId}:tool:${String(toolName).replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 80)}`, parentTaskId: parent.taskId });
    const entry = ledger.add({ agentId: toolAgentId, action: `tool:${toolName}`, status: 'running', parentTaskId: relation.parentTaskId });
    assertTraceContinuity(context.traceId, entry.traceId);
    return entry;
  }

  /**
   * @param {string} taskId
   * @param {{ ok?: boolean; error?: unknown; [key: string]: any } | null} [result]
   */
  function recordToolFinish(taskId, result) {
    const entry = ledger.read(taskId);
    if (!entry || entry.taskId === root.taskId || !entry.action.startsWith('tool:')) throw new Error('INVALID_TOOL_TASK_ID');
    assertTraceContinuity(context.traceId, entry.traceId);
    const ok = Boolean(result?.ok);
    return ledger.update(taskId, { status: ok ? 'completed' : 'failed', detail: ok ? 'ok' : String(result?.error || 'TOOL_EXECUTION_FAILED').slice(0, 120) });
  }

  /**
   * @param {string} targetAgentId
   * @param {{ parentTaskId?: string }} [options]
   */
  function recordDelegationStart(targetAgentId, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('INVALID_DELEGATION_OPTIONS');
    const { parentTaskId = root.taskId } = options;
    const parent = resolveParent(parentTaskId);
    const entry = ledger.add({ agentId: targetAgentId, action: 'agent.delegate', status: 'running', parentTaskId: parent.taskId });
    assertTraceContinuity(context.traceId, entry.traceId);
    return entry;
  }

  /**
   * @param {string} taskId
   * @param {{ ok?: boolean; error?: unknown; [key: string]: any } | null} [result]
   */
  function recordDelegationFinish(taskId, result) {
    const entry = ledger.read(taskId);
    if (!entry || entry.action !== 'agent.delegate') throw new Error('INVALID_DELEGATION_TASK_ID');
    assertTraceContinuity(context.traceId, entry.traceId);
    const ok = Boolean(result?.ok);
    return ledger.update(taskId, { status: ok ? 'completed' : 'failed', detail: ok ? 'ok' : String(result?.error || 'DELEGATED_AGENT_FAILED').slice(0, 120) });
  }

  /**
   * @param {{ ok?: boolean; detail?: unknown }} [options]
   */
  function finish(options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('INVALID_FINISH_OPTIONS');
    const { ok = true, detail = null } = options;
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
