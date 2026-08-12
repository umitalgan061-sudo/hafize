function cleanErrorCode(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^[A-Z0-9_:-]{1,120}$/.test(text) ? text : 'SCHEDULE_EXECUTION_FAILED';
}

function resolveAgent(registry, agentId) {
  return Array.isArray(registry?.agents)
    ? registry.agents.find((agent) => agent?.id === agentId) || null
    : null;
}

export function createScheduleWorker({
  store,
  registry,
  executeAgentTask,
  now = () => new Date(),
  retryDelayMs = 60_000,
  maxBatch = 4
} = {}) {
  if (typeof store?.claimDue !== 'function' || typeof store?.complete !== 'function' || typeof store?.fail !== 'function') {
    throw new Error('INVALID_SCHEDULE_WORKER:store');
  }
  if (!Array.isArray(registry?.agents)) throw new Error('INVALID_SCHEDULE_WORKER:registry');
  if (typeof executeAgentTask !== 'function') throw new Error('INVALID_SCHEDULE_WORKER:executeAgentTask');

  const batchLimit = Number.isInteger(maxBatch) ? Math.min(Math.max(maxBatch, 1), 16) : 4;
  const retryDelay = Number.isInteger(retryDelayMs) ? Math.min(Math.max(retryDelayMs, 1_000), 86_400_000) : 60_000;

  function currentDate() {
    const value = now();
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error('INVALID_SCHEDULE_WORKER:now');
    return date;
  }

  async function runDue({ limit = batchLimit } = {}) {
    const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), batchLimit) : batchLimit;
    const claimed = store.claimDue({ limit: safeLimit });
    const results = [];

    for (const schedule of claimed) {
      const agent = resolveAgent(registry, schedule.agentId);
      if (!agent) {
        store.fail(schedule.scheduleId, { error: 'SCHEDULE_AGENT_NOT_FOUND' });
        results.push({ scheduleId: schedule.scheduleId, ok: false, error: 'SCHEDULE_AGENT_NOT_FOUND' });
        continue;
      }

      let result;
      try {
        result = await executeAgentTask({
          scheduleId: schedule.scheduleId,
          traceId: schedule.traceId,
          agent,
          task: schedule.task,
          attempt: schedule.attempts
        });
      } catch {
        result = { ok: false, error: 'SCHEDULE_EXECUTION_FAILED' };
      }

      if (result?.ok) {
        store.complete(schedule.scheduleId);
        results.push({ scheduleId: schedule.scheduleId, ok: true });
        continue;
      }

      const error = cleanErrorCode(result?.error);
      const canRetry = schedule.attempts < schedule.maxAttempts;
      if (canRetry) {
        const retryAt = new Date(currentDate().getTime() + retryDelay).toISOString();
        store.fail(schedule.scheduleId, { error, retryAt });
      } else {
        store.fail(schedule.scheduleId, { error });
      }
      results.push({ scheduleId: schedule.scheduleId, ok: false, error, retryScheduled: canRetry });
    }

    return { claimed: claimed.length, results };
  }

  return Object.freeze({ runDue });
}
