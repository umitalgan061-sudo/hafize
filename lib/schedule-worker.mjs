function cleanErrorCode(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^[A-Z0-9_:-]{1,120}$/.test(text) ? text : 'SCHEDULE_EXECUTION_FAILED';
}

function resolveAgent(registry, agentId) {
  return Array.isArray(registry?.agents) ? registry.agents.find((agent) => agent?.id === agentId) || null : null;
}

export function createScheduleWorker({
  store,
  registry,
  executeAgentTask,
  now = () => new Date(),
  retryDelayMs = 60_000,
  maxBatch = 16,
  maxConcurrent = 4,
  maxBatchesPerTick = 8
} = {}) {
  if (typeof store?.claimDue !== 'function' || typeof store?.complete !== 'function' || typeof store?.fail !== 'function') throw new Error('INVALID_SCHEDULE_WORKER:store');
  if (!Array.isArray(registry?.agents)) throw new Error('INVALID_SCHEDULE_WORKER:registry');
  if (typeof executeAgentTask !== 'function') throw new Error('INVALID_SCHEDULE_WORKER:executeAgentTask');

  const batchLimit = Number.isInteger(maxBatch) ? Math.min(Math.max(maxBatch, 1), 64) : 16;
  const concurrency = Number.isInteger(maxConcurrent) ? Math.min(Math.max(maxConcurrent, 1), 8) : 4;
  const rounds = Number.isInteger(maxBatchesPerTick) ? Math.min(Math.max(maxBatchesPerTick, 1), 64) : 8;
  const retryDelay = Number.isInteger(retryDelayMs) ? Math.min(Math.max(retryDelayMs, 1_000), 86_400_000) : 60_000;

  function currentDate() {
    const value = now();
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error('INVALID_SCHEDULE_WORKER:now');
    return date;
  }

  function retryAtFromResult(value) {
    const current = currentDate(); const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed.getTime() > current.getTime() ? parsed.toISOString() : new Date(current.getTime() + retryDelay).toISOString();
  }

  async function executeOne(schedule) {
    const agent = resolveAgent(registry, schedule.agentId);
    if (!agent) {
      await store.fail(schedule.scheduleId, { error: 'SCHEDULE_AGENT_NOT_FOUND' });
      return { scheduleId: schedule.scheduleId, ok: false, error: 'SCHEDULE_AGENT_NOT_FOUND' };
    }

    let result;
    try {
      result = await executeAgentTask({ scheduleId: schedule.scheduleId, traceId: schedule.traceId, agent, task: schedule.task, attempt: schedule.attempts });
    } catch {
      result = { ok: false, error: 'SCHEDULE_EXECUTION_FAILED' };
    }

    if (result?.ok) {
      await store.complete(schedule.scheduleId);
      return { scheduleId: schedule.scheduleId, ok: true };
    }

    const error = cleanErrorCode(result?.error);
    if (error === 'SCHEDULE_LEASE_BUSY' && typeof store.defer === 'function') {
      const retryAt = retryAtFromResult(result?.retryAt);
      await store.defer(schedule.scheduleId, { error, runAt: retryAt });
      return { scheduleId: schedule.scheduleId, ok: false, error, retryScheduled: true, retryAt, attemptRefunded: true };
    }

    const canRetry = schedule.attempts < schedule.maxAttempts;
    if (canRetry) {
      const retryAt = new Date(currentDate().getTime() + retryDelay).toISOString();
      await store.fail(schedule.scheduleId, { error, retryAt });
    } else {
      await store.fail(schedule.scheduleId, { error });
    }
    return { scheduleId: schedule.scheduleId, ok: false, error, retryScheduled: canRetry };
  }

  async function runDue({ limit = batchLimit } = {}) {
    const requested = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), batchLimit * rounds) : batchLimit;
    const results = []; let claimedTotal = 0; let batches = 0;
    while (claimedTotal < requested && batches < rounds) {
      const batch = await store.claimDue({ limit: Math.min(batchLimit, requested - claimedTotal) });
      if (!batch.length) break;
      claimedTotal += batch.length; batches += 1;
      for (let index = 0; index < batch.length; index += concurrency) {
        const wave = batch.slice(index, index + concurrency);
        const settled = await Promise.allSettled(wave.map((schedule) => executeOne(schedule)));
        settled.forEach((entry, waveIndex) => {
          if (entry.status === 'fulfilled') results.push(entry.value);
          else results.push({ scheduleId: wave[waveIndex].scheduleId, ok: false, error: 'SCHEDULE_EXECUTION_FAILED' });
        });
      }
    }
    return { claimed: claimedTotal, batches, concurrency, results };
  }

  return Object.freeze({ runDue });
}
