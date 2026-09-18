import type { TaskLedgerEntry, TaskLedgerSnapshot } from './runtime-contracts.ts';
import { createTaskLedger } from './task-ledger.mjs';
import { createTraceContext, normalizeTaskRelation, assertTraceContinuity } from './trace-consistency.mjs';

interface ToolTaskOptions { readonly parentTaskId?: string; readonly toolAgentId?: string; }
interface FinishOptions { readonly ok?: boolean; readonly detail?: unknown; }
interface AgentRunOptions { readonly traceId: unknown; readonly agentId: unknown; readonly action?: unknown; readonly now?: () => number; }

export interface AgentRunLedger {
  readonly rootTaskId: string;
  readonly traceId: string;
  readonly recordToolStart: (toolName: unknown, options?: ToolTaskOptions) => TaskLedgerEntry;
  readonly recordToolFinish: (taskId: unknown, result: unknown) => TaskLedgerEntry;
  readonly recordDelegationStart: (targetAgentId: unknown, options?: { readonly parentTaskId?: string }) => TaskLedgerEntry;
  readonly recordDelegationFinish: (taskId: unknown, result: unknown) => TaskLedgerEntry;
  readonly finish: (options?: FinishOptions) => TaskLedgerEntry;
  readonly snapshot: () => TaskLedgerSnapshot;
}

export function createAgentRunLedger({
  traceId,
  agentId,
  action = 'agent.run',
  now
}: AgentRunOptions): AgentRunLedger {
  const context = createTraceContext(traceId);
  const ledger = createTaskLedger({ traceId: context.traceId, now });
  const root = ledger.add({ agentId, action, status: 'running' });

  function resolveParent(parentTaskId: string): TaskLedgerEntry {
    const parent = ledger.read(parentTaskId);
    if (!parent) throw new Error('TASK_PARENT_NOT_FOUND');
    assertTraceContinuity(context.traceId, parent.traceId);
    return parent;
  }

  function recordToolStart(toolName: unknown, options: ToolTaskOptions = {}): TaskLedgerEntry {
    const parentTaskId = options.parentTaskId || root.taskId;
    const toolAgentId = options.toolAgentId || String(agentId);
    const parent = resolveParent(parentTaskId);
    const relation = normalizeTaskRelation({
      traceId: context.traceId,
      taskId: root.taskId + ':tool:' + String(toolName).replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 80),
      parentTaskId: parent.taskId
    });
    const entry = ledger.add({
      agentId: toolAgentId,
      action: 'tool:' + String(toolName),
      status: 'running',
      parentTaskId: relation.parentTaskId
    });
    assertTraceContinuity(context.traceId, entry.traceId);
    return entry;
  }

  function recordToolFinish(taskId: unknown, result: unknown): TaskLedgerEntry {
    const entry = ledger.read(String(taskId));
    if (!entry || entry.taskId === root.taskId || !entry.action.startsWith('tool:')) throw new Error('INVALID_TOOL_TASK_ID');
    assertTraceContinuity(context.traceId, entry.traceId);
    const value = result && typeof result === 'object' ? result as Record<string, unknown> : {};
    const ok = value.ok === true;
    return ledger.update(entry.taskId, {
      status: ok ? 'completed' : 'failed',
      detail: ok ? 'ok' : String(value.error || 'TOOL_EXECUTION_FAILED').slice(0, 120)
    });
  }

  function recordDelegationStart(targetAgentId: unknown, options: { readonly parentTaskId?: string } = {}): TaskLedgerEntry {
    const parent = resolveParent(options.parentTaskId || root.taskId);
    const entry = ledger.add({
      agentId: String(targetAgentId),
      action: 'agent.delegate',
      status: 'running',
      parentTaskId: parent.taskId
    });
    assertTraceContinuity(context.traceId, entry.traceId);
    return entry;
  }

  function recordDelegationFinish(taskId: unknown, result: unknown): TaskLedgerEntry {
    const entry = ledger.read(String(taskId));
    if (!entry || entry.action !== 'agent.delegate') throw new Error('INVALID_DELEGATION_TASK_ID');
    assertTraceContinuity(context.traceId, entry.traceId);
    const value = result && typeof result === 'object' ? result as Record<string, unknown> : {};
    const ok = value.ok === true;
    return ledger.update(entry.taskId, {
      status: ok ? 'completed' : 'failed',
      detail: ok ? 'ok' : String(value.error || 'DELEGATED_AGENT_FAILED').slice(0, 120)
    });
  }

  function finish(options: FinishOptions = {}): TaskLedgerEntry {
    const ok = options.ok !== false;
    return ledger.update(root.taskId, {
      status: ok ? 'completed' : 'failed',
      detail: options.detail == null ? null : String(options.detail).slice(0, 120)
    });
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