import { createTaskLedger } from './task-ledger.mjs';
import { normalizeToolExecutionResult } from './tool-execution-result-policy.mjs';

const TERMINAL_STATUS = new Set(['completed', 'failed', 'blocked']);

export function createAgentRunLedger({ traceId, agentId, action = 'agent.run', now } = {}) {
  const ledger = createTaskLedger({ traceId, now });
  const root = ledger.add({ agentId, action, status: 'running' });
  const sealedTaskIds = new Set();
  const toolTaskIds = new Set();
  const delegationTaskIds = new Set();
  let rootSealed = false;

  function terminalRead(taskId) {
    return sealedTaskIds.has(taskId) ? ledger.read(taskId) : null;
  }

  function requireRunningParent(parentTaskId) {
    const parent = ledger.read(parentTaskId);
    if (!parent) throw new Error('AGENT_RUN_PARENT_NOT_FOUND');
    if (parent.status !== 'running') throw new Error('AGENT_RUN_PARENT_NOT_RUNNING');
    return parent;
  }

  function recordToolStart(toolName, { parentTaskId = root.taskId, toolAgentId = agentId } = {}) {
    if (rootSealed) throw new Error('AGENT_RUN_ALREADY_FINISHED');
    requireRunningParent(parentTaskId);
    const entry = ledger.add({
      agentId: toolAgentId,
      action: `tool:${toolName}`,
      status: 'running',
      parentTaskId
    });
    toolTaskIds.add(entry.taskId);
    return entry;
  }

  function recordToolFinish(taskId, result) {
    if (!toolTaskIds.has(taskId)) throw new Error('AGENT_RUN_TOOL_TASK_NOT_FOUND');
    const terminal = terminalRead(taskId);
    if (terminal) return terminal;
    const normalized = normalizeToolExecutionResult(result);
    const entry = ledger.update(taskId, {
      status: normalized.ok ? 'completed' : 'failed',
      detail: normalized.ok ? 'ok' : normalized.error
    });
    sealedTaskIds.add(taskId);
    return entry;
  }

  function recordDelegationStart(targetAgentId, { parentTaskId = root.taskId } = {}) {
    if (rootSealed) throw new Error('AGENT_RUN_ALREADY_FINISHED');
    requireRunningParent(parentTaskId);
    const entry = ledger.add({
      agentId: targetAgentId,
      action: 'agent.delegate',
      status: 'running',
      parentTaskId
    });
    delegationTaskIds.add(entry.taskId);
    return entry;
  }

  function recordDelegationFinish(taskId, result) {
    if (!delegationTaskIds.has(taskId)) throw new Error('AGENT_RUN_DELEGATION_TASK_NOT_FOUND');
    const terminal = terminalRead(taskId);
    if (terminal) return terminal;
    const ok = result?.ok === true;
    const entry = ledger.update(taskId, {
      status: ok ? 'completed' : result?.blocked === true ? 'blocked' : 'failed',
      detail: ok ? 'ok' : String(result?.error || 'DELEGATED_AGENT_FAILED')
    });
    sealedTaskIds.add(taskId);
    return entry;
  }

  function failOpenEntries(detail = 'AGENT_RUN_ABORTED') {
    if (rootSealed) return 0;
    const terminalDetail = String(detail || 'AGENT_RUN_ABORTED');
    let failed = 0;
    for (const entry of ledger.snapshot().entries) {
      if (entry.taskId === root.taskId || entry.status !== 'running') continue;
      ledger.update(entry.taskId, { status: 'failed', detail: terminalDetail });
      sealedTaskIds.add(entry.taskId);
      failed += 1;
    }
    return failed;
  }

  function hasOpenChildren() {
    return ledger.snapshot().entries.some((entry) => entry.taskId !== root.taskId && !TERMINAL_STATUS.has(entry.status));
  }

  function finish({ ok = true, detail = null } = {}) {
    if (rootSealed) return ledger.read(root.taskId);
    if (hasOpenChildren()) throw new Error('AGENT_RUN_HAS_OPEN_TASKS');
    const entry = ledger.update(root.taskId, {
      status: ok === true ? 'completed' : 'failed',
      detail
    });
    rootSealed = true;
    sealedTaskIds.add(root.taskId);
    return entry;
  }

  return Object.freeze({
    rootTaskId: root.taskId,
    recordToolStart,
    recordToolFinish,
    recordDelegationStart,
    recordDelegationFinish,
    failOpenEntries,
    finish,
    snapshot: ledger.snapshot
  });
}
