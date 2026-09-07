import { classifyScheduleOutcome } from './schedule-reliability.mjs';

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

  function retryAtFromResult(value) {
    const current = currentDate();
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > current.getTime()) return parsed.toISOString();
    return new Date(current.getTime() + retryDelay).toISOString();
  }

  async function runDue({ limit = batchLimit } = {}) {
    const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), batchLimit) : batchLimit;
    const claimed = await store.claimDue({ limit: safeLimit });
    const results = [];

    for (const schedule of claimed) {
      const agent = resolveAgent(registry, schedule.agentId);
      if (!agent) {
        await store.fail(schedule.scheduleId, { error: 'SCHEDULE_AGENT_NOT_FOUND' });
        results.push({ scheduleId: schedule.scheduleId, ok: false, error: 'SCHEDULE_AGENT_NOT_FOUND' });
        continue;
      }

      let rawResult;
      try {
        rawResult = await executeAgentTask({
          scheduleId: schedule.scheduleId,
          traceId: schedule.traceId,
          agent,
          task: schedule.task,
          attempt: schedule.attempts
        });
      } catch {
        rawResult = { ok: false, error: 'SCHEDULE_EXECUTION_FAILED' };
      }

      const outcome = classifyScheduleOutcome(rawResult, schedule);
      if (outcome.status === 'completed') {
        await store.complete(schedule.scheduleId);
        results.push({ scheduleId: schedule.scheduleId, ok: true });
        continue;
      }

      if (outcome.status === 'deferred' && typeof store.defer === 'function') {
        const retryAt = retryAtFromResult(outcome.retryAt);
        await store.defer(schedule.scheduleId, { error: outcome.error, runAt: retryAt });
        results.push({ scheduleId: schedule.scheduleId, ok: false, error: outcome.error, retryScheduled: true, retryAt, attemptRefunded: true });
        continue;
      }

      if (outcome.retry) {
        const retryAt = new Date(currentDate().getTime() + retryDelay).toISOString();
        await store.fail(schedule.scheduleId, { error: outcome.error, retryAt });
        results.push({ scheduleId: schedule.scheduleId, ok: false, error: outcome.error, retryScheduled: true });
      } else {
        await store.fail(schedule.scheduleId, { error: outcome.error });
        results.push({ scheduleId: schedule.scheduleId, ok: false, error: outcome.error, retryScheduled: false });
      }
    }

    return { claimed: claimed.length, results };
  }

  return Object.freeze({ runDue });
}
