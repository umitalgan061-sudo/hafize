import { createTaskLedger } from './task-ledger.mjs';

export function createAgentRunLedger({ traceId, agentId, action = 'agent.run', now } = {}) {
  const ledger = createTaskLedger({ traceId, now });
  const root = ledger.add({ agentId, action, status: 'running' });
  const sealedTaskIds = new Set();

  function terminalRead(taskId) {
    return sealedTaskIds.has(taskId) ? ledger.read(taskId) : null;
  }

  function recordToolStart(toolName, { parentTaskId = root.taskId, toolAgentId = agentId } = {}) {
    return ledger.add({
      agentId: toolAgentId,
      action: `tool:${toolName}`,
      status: 'running',
      parentTaskId
    });
  }

  function recordToolFinish(taskId, result) {
    const terminal = terminalRead(taskId);
    if (terminal) return terminal;
    const ok = Boolean(result?.ok);
    return ledger.update(taskId, {
      status: ok ? 'completed' : 'failed',
      detail: ok ? 'ok' : String(result?.error || 'TOOL_EXECUTION_FAILED')
    });
  }

  function recordDelegationStart(targetAgentId, { parentTaskId = root.taskId } = {}) {
    return ledger.add({
      agentId: targetAgentId,
      action: 'agent.delegate',
      status: 'running',
      parentTaskId
    });
  }

  function recordDelegationFinish(taskId, result) {
    const terminal = terminalRead(taskId);
    if (terminal) return terminal;
    const ok = Boolean(result?.ok);
    return ledger.update(taskId, {
      status: ok ? 'completed' : result?.blocked === true ? 'blocked' : 'failed',
      detail: ok ? 'ok' : String(result?.error || 'DELEGATED_AGENT_FAILED')
    });
  }

  function failOpenEntries(detail = 'AGENT_RUN_ABORTED') {
    const terminalDetail = String(detail || 'AGENT_RUN_ABORTED');
    for (const entry of ledger.snapshot().entries) {
      if (entry.taskId === root.taskId || entry.status !== 'running') continue;
      ledger.update(entry.taskId, { status: 'failed', detail: terminalDetail });
      sealedTaskIds.add(entry.taskId);
    }
  }

  function finish({ ok = true, detail = null } = {}) {
    return ledger.update(root.taskId, {
      status: ok ? 'completed' : 'failed',
      detail
    });
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
