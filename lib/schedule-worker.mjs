const DEFAULT_MAX_ATTEMPTS = 1;
const DEFAULT_MAX_BATCH = 8;
const DEFAULT_MAX_CONCURRENCY = 2;
const MAX_BATCH_LIMIT = 64;
const MAX_CONCURRENCY_LIMIT = 8;
const MAX_INFRA_RETRY_HORIZON_MS = 86_400_000;
const REFUNDABLE_INFRA_ERRORS = new Set(['SCHEDULE_LEASE_BUSY', 'SCHEDULE_LEASE_LOST']);

function cleanErrorCode(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^[A-Z0-9_:-]{1,120}$/.test(text) ? text : 'SCHEDULE_EXECUTION_FAILED';
}

function resolveAgent(registry, agentId) {
  return Array.isArray(registry?.agents)
    ? registry.agents.find((agent) => agent?.id === agentId) || null
    : null;
}

function normalizePositiveBoundedInteger(value, fallback, max, label) {
  if (value == null) return fallback;
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new Error(`INVALID_SCHEDULE_WORKER:${label}`);
  }
  return value;
}

async function mapWithConcurrency(items, concurrency, worker) {
  if (!Array.isArray(items)) throw new Error('INVALID_SCHEDULE_WORKER:items');
  if (typeof worker !== 'function') throw new Error('INVALID_SCHEDULE_WORKER:worker');
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > MAX_CONCURRENCY_LIMIT) {
    throw new Error('INVALID_SCHEDULE_WORKER:maxConcurrency');
  }
  if (!items.length) return [];

  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  async function runLane() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, runLane));
  return results;
}

export function createScheduleWorker({
  store,
  registry,
  executeAgentTask,
  now = () => new Date(),
  retryDelayMs = 60_000,
  maxBatch = DEFAULT_MAX_BATCH,
  maxConcurrency = DEFAULT_MAX_CONCURRENCY
} = {}) {
  if (typeof store?.claimDue !== 'function' || typeof store?.complete !== 'function' || typeof store?.fail !== 'function') {
    throw new Error('INVALID_SCHEDULE_WORKER:store');
  }
  if (!Array.isArray(registry?.agents)) throw new Error('INVALID_SCHEDULE_WORKER:registry');
  if (typeof executeAgentTask !== 'function') throw new Error('INVALID_SCHEDULE_WORKER:executeAgentTask');

  const fallbackRetryDelay = Number.isInteger(retryDelayMs)
    ? Math.min(Math.max(retryDelayMs, 1_000), 86_400_000)
    : 60_000;
  const configuredBatchLimit = normalizePositiveBoundedInteger(
    maxBatch,
    DEFAULT_MAX_BATCH,
    MAX_BATCH_LIMIT,
    'maxBatch'
  );
  const configuredConcurrency = normalizePositiveBoundedInteger(
    maxConcurrency,
    DEFAULT_MAX_CONCURRENCY,
    MAX_CONCURRENCY_LIMIT,
    'maxConcurrency'
  );

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
    const delay = parsed.getTime() - current.getTime();
    if (!Number.isNaN(parsed.getTime()) && delay > 0 && delay <= MAX_INFRA_RETRY_HORIZON_MS) {
      return parsed.toISOString();
    }
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
    if (REFUNDABLE_INFRA_ERRORS.has(error) && typeof store.defer === 'function') {
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
    const requestedLimit = normalizePositiveBoundedInteger(
      limit,
      configuredBatchLimit,
      MAX_BATCH_LIMIT,
      'limit'
    );
    const claimLimit = Math.min(requestedLimit, configuredBatchLimit);
    const claimed = await store.claimDue({ limit: claimLimit });
    if (!Array.isArray(claimed)) throw new Error('INVALID_SCHEDULE_WORKER:claimed');
    if (claimed.length > claimLimit) throw new Error('INVALID_SCHEDULE_WORKER:claim_limit_exceeded');
    const results = await mapWithConcurrency(claimed, configuredConcurrency, executeClaimed);
    return {
      claimed: claimed.length,
      results,
      limits: Object.freeze({ batch: configuredBatchLimit, concurrency: configuredConcurrency })
    };
  }

  return Object.freeze({
    runDue,
    limits: Object.freeze({ batch: configuredBatchLimit, concurrency: configuredConcurrency })
  });
}

export const SCHEDULE_WORKER_LIMITS = Object.freeze({
  defaultMaxBatch: DEFAULT_MAX_BATCH,
  defaultMaxConcurrency: DEFAULT_MAX_CONCURRENCY,
  maxBatch: MAX_BATCH_LIMIT,
  maxConcurrency: MAX_CONCURRENCY_LIMIT,
  maxInfraRetryHorizonMs: MAX_INFRA_RETRY_HORIZON_MS
});

export { REFUNDABLE_INFRA_ERRORS, mapWithConcurrency, normalizePositiveBoundedInteger };
