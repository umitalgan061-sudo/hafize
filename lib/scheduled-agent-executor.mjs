import { createAgentRunLedger } from './agent-run-ledger.mjs';
import { runDelegatedAgent } from './delegated-agent-runner.mjs';

function cleanText(value, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && text.length <= maxLength ? text : null;
}

function cleanErrorCode(value) {
  const text = cleanText(value, 120);
  return text && /^[A-Z0-9_:-]+$/.test(text) ? text : 'SCHEDULE_AGENT_RUN_FAILED';
}

export function createScheduledAgentExecutor({
  registry,
  model,
  complete,
  maxTokens = 2048,
  nvidiaConfigured = false,
  githubReadConfigured = false,
  githubReadFile,
  runAgentTask = runDelegatedAgent
} = {}) {
  if (!Array.isArray(registry?.agents)) throw new Error('INVALID_SCHEDULE_AGENT_EXECUTOR:registry');
  if (typeof complete !== 'function') throw new Error('INVALID_SCHEDULE_AGENT_EXECUTOR:complete');
  if (typeof runAgentTask !== 'function') throw new Error('INVALID_SCHEDULE_AGENT_EXECUTOR:runAgentTask');

  const safeModel = cleanText(model, 300);
  const tokenLimit = Number.isInteger(maxTokens) ? Math.min(Math.max(maxTokens, 1), 8192) : 2048;

  async function executeAgentTask(request) {
    const safeTraceId = cleanText(request?.traceId, 128);
    const safeTask = cleanText(request?.task, 20000);
    const agentId = request?.agent?.id;
    const canonicalAgent = typeof agentId === 'string'
      ? registry.agents.find((item) => item?.id === agentId) || null
      : null;
    if (!safeTraceId || !safeTask || !canonicalAgent) {
      return { ok: false, error: 'INVALID_SCHEDULE_AGENT_TASK' };
    }
    if (!safeModel) return { ok: false, error: 'SCHEDULE_MODEL_NOT_CONFIGURED' };

    const runLedger = createAgentRunLedger({
      traceId: safeTraceId,
      agentId: canonicalAgent.id,
      action: 'schedule.run'
    });

    let result;
    try {
      result = await runAgentTask({
        agent: canonicalAgent,
        task: safeTask,
        traceId: safeTraceId,
        parentTaskId: runLedger.rootTaskId,
        depth: 0,
        registry,
        runLedger,
        model: safeModel,
        maxTokens: tokenLimit,
        complete,
        nvidiaConfigured: Boolean(nvidiaConfigured),
        githubReadConfigured: Boolean(githubReadConfigured),
        githubReadFile
      });
    } catch {
      result = { ok: false, error: 'SCHEDULE_AGENT_RUN_FAILED' };
    }

    if (!result?.ok) {
      const error = cleanErrorCode(result?.error);
      runLedger.finish({ ok: false, detail: error });
      return { ok: false, error, taskLedger: runLedger.snapshot() };
    }

    runLedger.finish({ ok: true });
    return {
      ok: true,
      content: typeof result.content === 'string' ? result.content : '',
      taskLedger: runLedger.snapshot()
    };
  }

  return Object.freeze({ configured: Boolean(safeModel), executeAgentTask });
}
