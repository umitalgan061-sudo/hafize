import { createTaskLedger } from './task-ledger.mjs';

export function createAgentRunLedger({ traceId, agentId, action = 'agent.run', now } = {}) {
  const ledger = createTaskLedger({ traceId, now });
  const root = ledger.add({ agentId, action, status: 'running' });

  function recordToolStart(toolName) {
    return ledger.add({
      agentId,
      action: `tool:${toolName}`,
      status: 'running',
      parentTaskId: root.taskId
    });
  }

  function recordToolFinish(taskId, result) {
    const ok = Boolean(result?.ok);
    return ledger.update(taskId, {
      status: ok ? 'completed' : 'failed',
      detail: ok ? 'ok' : String(result?.error || 'TOOL_EXECUTION_FAILED')
    });
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
    finish,
    snapshot: ledger.snapshot
  });
}
