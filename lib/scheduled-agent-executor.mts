import { createAgentRunLedger } from './agent-run-ledger.mts';
import { runDelegatedAgent } from './delegated-agent-runner.mts';
import { containsPlaintextCredential } from './plaintext-credential-policy.mts';

function cleanText(value: unknown, maxLength: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && text.length <= maxLength ? text : null;
}

function cleanErrorCode(value: unknown) {
  const text = cleanText(value, 120);
  return text && /^[A-Z0-9_:-]+$/.test(text) ? text : 'SCHEDULE_AGENT_RUN_FAILED';
}

/**
 * Zamanlanmış görevleri ajan çalıştırıcısına bağlar.
 */
export function createScheduledAgentExecutor({ registry, model, complete, maxTokens = 2048, nvidiaConfigured = false, githubReadConfigured = false, githubReadFile, runAgentTask = runDelegatedAgent }: { registry?: { agents?: any[] }; model?: string; complete?: Function; maxTokens?: number; nvidiaConfigured?: boolean; githubReadConfigured?: boolean; githubReadFile?: Function; runAgentTask?: Function; } = {}) {
  if (!Array.isArray(registry?.agents)) throw new Error('INVALID_SCHEDULE_AGENT_EXECUTOR:registry');
  if (typeof complete !== 'function') throw new Error('INVALID_SCHEDULE_AGENT_EXECUTOR:complete');
  if (typeof runAgentTask !== 'function') throw new Error('INVALID_SCHEDULE_AGENT_EXECUTOR:runAgentTask');

  const safeModel = cleanText(model, 300);
  const tokenLimit = Number.isInteger(maxTokens) ? Math.min(Math.max(maxTokens, 1), 8192) : 2048;

  async function executeAgentTask({ traceId, agent, task }: { traceId?: string; agent?: any; task?: string } = {}) {
    const safeTraceId = cleanText(traceId, 128);
    const safeTask = cleanText(task, 20000);
    const canonicalAgent = typeof agent?.id === 'string'
      ? registry.agents.find((item) => item?.id === agent.id) || null
      : null;
    if (!safeTraceId || !safeTask || !canonicalAgent) {
      return { ok: false as const, error: 'INVALID_SCHEDULE_AGENT_TASK' };
    }
    if (!safeModel) return { ok: false as const, error: 'SCHEDULE_MODEL_NOT_CONFIGURED' };
    if (containsPlaintextCredential(safeTask)) return { ok: false as const, error: 'SCHEDULE_AGENT_TASK_CREDENTIAL_BLOCKED' };

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
      result = { ok: false as const, error: 'SCHEDULE_AGENT_RUN_FAILED' };
    }

    if (!result?.ok) {
      const error = cleanErrorCode(result?.error);
      runLedger.finish({ ok: false as const, detail: error });
      return { ok: false as const, error, taskLedger: runLedger.snapshot() };
    }
    if (containsPlaintextCredential(typeof result.content === 'string' ? result.content : '')) {
      runLedger.finish({ ok: false as const, detail: 'SCHEDULE_AGENT_RESULT_CREDENTIAL_BLOCKED' });
      return { ok: false as const, error: 'SCHEDULE_AGENT_RESULT_CREDENTIAL_BLOCKED', taskLedger: runLedger.snapshot() };
    }

    runLedger.finish({ ok: true as const });
    return {
      ok: true as const,
      content: typeof result.content === 'string' ? result.content : '',
      taskLedger: runLedger.snapshot()
    };
  }

  return Object.freeze({ configured: Boolean(safeModel), executeAgentTask });
}
