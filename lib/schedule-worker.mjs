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
  maxBatch = null
} = {}) {
  if (typeof store?.claimDue !== 'function' || typeof store?.complete !== 'function' || typeof store?.fail !== 'function') {
    throw new Error('INVALID_SCHEDULE_WORKER:store');
  }
  if (!Array.isArray(registry?.agents)) throw new Error('INVALID_SCHEDULE_WORKER:registry');
  if (typeof executeAgentTask !== 'function') throw new Error('INVALID_SCHEDULE_WORKER:executeAgentTask');

  const fallbackRetryDelay = Number.isInteger(retryDelayMs)
    ? Math.min(Math.max(retryDelayMs, 1_000), 86_400_000)
    : 60_000;
  const configuredBatchLimit = maxBatch == null
    ? null
    : (Number.isSafeInteger(maxBatch) && maxBatch > 0 ? maxBatch : null);
  if (maxBatch != null && configuredBatchLimit == null) throw new Error('INVALID_SCHEDULE_WORKER:maxBatch');

  function currentDate() {
    const value = now();
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error('INVALID_SCHEDULE_WORKER:now');
    return date;
  }

  function scheduleRetryDelay(schedule) {
    return Number.isSafeInteger(schedule?.retryDelayMs)
      && schedule.retryDelayMs >= 1_000
      && schedule.retryDelayMs <= 86_400_000
      ? schedule.retryDelayMs
      : fallbackRetryDelay;
  }

  function retryAtFromResult(value, schedule) {
    const current = currentDate();
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > current.getTime()) return parsed.toISOString();
    return new Date(current.getTime() + scheduleRetryDelay(schedule)).toISOString();
  }

  async function executeClaimed(schedule) {
    const agent = resolveAgent(registry, schedule.agentId);
    if (!agent) {
      await store.fail(schedule.scheduleId, { error: 'SCHEDULE_AGENT_NOT_FOUND' });
      return { scheduleId: schedule.scheduleId, ok: false, error: 'SCHEDULE_AGENT_NOT_FOUND' };
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
      await store.complete(schedule.scheduleId);
      return { scheduleId: schedule.scheduleId, ok: true };
    }

    const error = cleanErrorCode(result?.error);
    if (error === 'SCHEDULE_LEASE_BUSY' && typeof store.defer === 'function') {
      const retryAt = retryAtFromResult(result?.retryAt, schedule);
      await store.defer(schedule.scheduleId, { error, runAt: retryAt });
      return {
        scheduleId: schedule.scheduleId,
        ok: false,
        error,
        retryScheduled: true,
        retryAt,
        attemptRefunded: true
      };
    }

    const canRetry = schedule.attempts < schedule.maxAttempts;
    if (canRetry) {
      const retryAt = new Date(currentDate().getTime() + scheduleRetryDelay(schedule)).toISOString();
      await store.fail(schedule.scheduleId, { error, retryAt });
    } else {
      await store.fail(schedule.scheduleId, { error });
    }
    return { scheduleId: schedule.scheduleId, ok: false, error, retryScheduled: canRetry };
  }

  async function runDue({ limit = configuredBatchLimit } = {}) {
    if (limit != null && (!Number.isSafeInteger(limit) || limit < 1)) {
      throw new Error('INVALID_SCHEDULE_WORKER:limit');
    }
    let claimLimit = limit;
    if (configuredBatchLimit != null && claimLimit != null) claimLimit = Math.min(claimLimit, configuredBatchLimit);
    const claimed = await store.claimDue({ limit: claimLimit });
    const results = await Promise.all(claimed.map(executeClaimed));
    return { claimed: claimed.length, results };
  }

  return Object.freeze({ runDue });
}
