import { createTaskLedger, type TaskLedger, type TaskLedgerEntry, type TaskStatus } from './task-ledger.ts';
import { assertTraceContinuity, createTraceContext, normalizeTaskRelation, type TraceContext } from './trace-consistency.ts';

interface ToolResult { readonly ok?: unknown; readonly error?: unknown; }
interface FinishOptions { readonly ok?: boolean; readonly detail?: unknown; }
interface ToolStartOptions { readonly parentTaskId?: unknown; readonly toolAgentId?: unknown; }
interface DelegationStartOptions { readonly parentTaskId?: unknown; }

export interface AgentRunLedger {
  readonly rootTaskId: string;
  readonly traceId: string;
  readonly recordToolStart: (toolName: unknown, options?: ToolStartOptions) => TaskLedgerEntry;
  readonly recordToolFinish: (taskId: unknown, result?: ToolResult) => TaskLedgerEntry;
  readonly recordDelegationStart: (targetAgentId: unknown, options?: DelegationStartOptions) => TaskLedgerEntry;
  readonly recordDelegationFinish: (taskId: unknown, result?: ToolResult) => TaskLedgerEntry;
  readonly finish: (options?: FinishOptions) => TaskLedgerEntry;
  readonly snapshot: () => { readonly traceId: string; readonly entries: readonly TaskLedgerEntry[] };
}

export function createAgentRunLedger(options: { readonly traceId?: unknown; readonly agentId?: unknown; readonly action?: unknown; readonly now?: () => Date } = {}): AgentRunLedger {
  const context: TraceContext = createTraceContext(typeof options.traceId === 'string' ? options.traceId : undefined);
  const agentId = typeof options.agentId === 'string' ? options.agentId : '';
  const action = typeof options.action === 'string' ? options.action : 'agent.run';
  const ledger: TaskLedger = createTaskLedger({ traceId: context.traceId, now: options.now });
  const root = ledger.add({ agentId, action, status: 'running' satisfies TaskStatus });

  function resolveParent(parentTaskId: unknown): TaskLedgerEntry {
    const parent = ledger.read(parentTaskId);
    if (!parent || !('taskId' in parent)) throw new Error('TASK_PARENT_NOT_FOUND');
    assertTraceContinuity(context.traceId, parent.traceId);
    return parent;
  }

  function recordToolStart(toolName: unknown, startOptions: ToolStartOptions = {}): TaskLedgerEntry {
    const name = String(toolName ?? '').trim();
    if (!name) throw new Error('INVALID_TOOL_NAME');
    const parent = resolveParent(startOptions.parentTaskId ?? root.taskId);
    const toolAgentId = startOptions.toolAgentId ?? agentId;
    const relation = normalizeTaskRelation({
      traceId: context.traceId,
      taskId: `${root.taskId}:tool:${name.replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 80)}`,
      parentTaskId: parent.taskId
    });
    const entry = ledger.add({ agentId: toolAgentId, action: `tool:${name}`, status: 'running', parentTaskId: relation.parentTaskId });
    assertTraceContinuity(context.traceId, entry.traceId);
    return entry;
  }

  function recordToolFinish(taskId: unknown, result: ToolResult = {}): TaskLedgerEntry {
    const entry = ledger.read(taskId);
    if (!entry || !('taskId' in entry) || entry.taskId === root.taskId || !entry.action.startsWith('tool:')) throw new Error('INVALID_TOOL_TASK_ID');
    assertTraceContinuity(context.traceId, entry.traceId);
    const ok = Boolean(result?.ok);
    return ledger.update(taskId, { status: ok ? 'completed' : 'failed', detail: ok ? 'ok' : String(result?.error || 'TOOL_EXECUTION_FAILED').slice(0, 120) });
  }

  function recordDelegationStart(targetAgentId: unknown, startOptions: DelegationStartOptions = {}): TaskLedgerEntry {
    const parent = resolveParent(startOptions.parentTaskId ?? root.taskId);
    const entry = ledger.add({ agentId: targetAgentId, action: 'agent.delegate', status: 'running', parentTaskId: parent.taskId });
    assertTraceContinuity(context.traceId, entry.traceId);
    return entry;
  }

  function recordDelegationFinish(taskId: unknown, result: ToolResult = {}): TaskLedgerEntry {
    const entry = ledger.read(taskId);
    if (!entry || !('taskId' in entry) || entry.action !== 'agent.delegate') throw new Error('INVALID_DELEGATION_TASK_ID');
    assertTraceContinuity(context.traceId, entry.traceId);
    const ok = Boolean(result?.ok);
    return ledger.update(taskId, { status: ok ? 'completed' : 'failed', detail: ok ? 'ok' : String(result?.error || 'DELEGATED_AGENT_FAILED').slice(0, 120) });
  }

  function finish(finishOptions: FinishOptions = {}): TaskLedgerEntry {
    const ok = finishOptions.ok ?? true;
    return ledger.update(root.taskId, { status: ok ? 'completed' : 'failed', detail: finishOptions.detail == null ? null : String(finishOptions.detail).slice(0, 120) });
  }

  return Object.freeze({ rootTaskId: root.taskId, traceId: context.traceId, recordToolStart, recordToolFinish, recordDelegationStart, recordDelegationFinish, finish, snapshot: ledger.snapshot });
}
