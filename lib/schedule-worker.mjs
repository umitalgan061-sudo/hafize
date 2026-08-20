import {
  normalizeScheduleExecutionResult,
  SCHEDULE_EXECUTION_RESULT_INVALID
} from './schedule-execution-result-policy.mjs';

const DEFAULT_MAX_ATTEMPTS = 1;
const DEFAULT_MAX_BATCH = 8;
const DEFAULT_MAX_CONCURRENCY = 2;
const MAX_BATCH_LIMIT = 64;
const MAX_CONCURRENCY_LIMIT = 8;
const MAX_INFRA_RETRY_HORIZON_MS = 86_400_000;
const MAX_SCHEDULE_ID_CHARS = 120;
const MAX_TRACE_ID_CHARS = 128;
const MAX_AGENT_ID_CHARS = 120;
const MAX_TASK_CHARS = 20_000;
const WORKER_CANCELLED_ERROR = 'SCHEDULE_EXECUTION_CANCELLED';
const WORKER_STATE_UNCERTAIN_ERROR = 'SCHEDULE_EXECUTION_STATE_UNCERTAIN';
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

function validSignal(signal) {
  return signal == null || (
    typeof signal === 'object' &&
    typeof signal.aborted === 'boolean' &&
    typeof signal.addEventListener === 'function'
  );
}

function validClaimText(value, maxLength) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength && value.trim() === value;
}

function validateClaimedBatch(claimed, claimLimit) {
  if (!Array.isArray(claimed)) throw new Error('INVALID_SCHEDULE_WORKER:claimed');
  if (claimed.length > claimLimit) throw new Error('INVALID_SCHEDULE_WORKER:claim_limit_exceeded');
  const scheduleIds = new Set();
  for (const schedule of claimed) {
    if (!schedule || Array.isArray(schedule) || typeof schedule !== 'object') {
      throw new Error('INVALID_SCHEDULE_WORKER:claimed_schedule');
    }
    if (!validClaimText(schedule.scheduleId, MAX_SCHEDULE_ID_CHARS)) {
      throw new Error('INVALID_SCHEDULE_WORKER:claimed_schedule_id');
    }
    if (scheduleIds.has(schedule.scheduleId)) throw new Error('INVALID_SCHEDULE_WORKER:duplicate_schedule_id');
    scheduleIds.add(schedule.scheduleId);
    if (!validClaimText(schedule.traceId, MAX_TRACE_ID_CHARS)) throw new Error('INVALID_SCHEDULE_WORKER:claimed_trace_id');
    if (!validClaimText(schedule.agentId, MAX_AGENT_ID_CHARS)) throw new Error('INVALID_SCHEDULE_WORKER:claimed_agent_id');
    if (!validClaimText(schedule.task, MAX_TASK_CHARS)) throw new Error('INVALID_SCHEDULE_WORKER:claimed_task');
    if (!Number.isSafeInteger(schedule.attempts) || schedule.attempts < 1) {
      throw new Error('INVALID_SCHEDULE_WORKER:claimed_attempts');
    }
    if (!Number.isSafeInteger(schedule.maxAttempts) || schedule.maxAttempts < schedule.attempts) {
      throw new Error('INVALID_SCHEDULE_WORKER:claimed_max_attempts');
    }
  }
  return claimed;
}

function uncertainResult(schedule, extra = {}) {
  return Object.freeze({
    scheduleId: typeof schedule?.scheduleId === 'string' ? schedule.scheduleId : null,
    ok: false,
    error: WORKER_STATE_UNCERTAIN_ERROR,
    outcomeUnknown: true,
    ...extra
  });
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

  async function deferWithoutAttempt(schedule, error, retryAt = null) {
    if (typeof store.defer !== 'function') return null;
    const runAt = retryAt || new Date(currentDate().getTime() + scheduleRetryDelay(schedule)).toISOString();
    await store.defer(schedule.scheduleId, { error, runAt });
    return {
      scheduleId: schedule.scheduleId,
      ok: false,
      error,
      retryScheduled: true,
      retryAt: runAt,
      attemptRefunded: true
    };
  }

  async function settlePreExecutionCancellation(schedule) {
    const deferred = await deferWithoutAttempt(schedule, WORKER_CANCELLED_ERROR);
    if (deferred) return { ...deferred, cancelled: true };

    const canRetry = schedule.attempts < schedule.maxAttempts;
    if (canRetry) {
      const retryAt = new Date(currentDate().getTime() + scheduleRetryDelay(schedule)).toISOString();
      await store.fail(schedule.scheduleId, { error: WORKER_CANCELLED_ERROR, retryAt });
      return {
        scheduleId: schedule.scheduleId,
        ok: false,
        error: WORKER_CANCELLED_ERROR,
        retryScheduled: true,
        retryAt,
        attemptRefunded: false,
        cancelled: true
      };
    }
    await store.fail(schedule.scheduleId, { error: WORKER_CANCELLED_ERROR });
    return {
      scheduleId: schedule.scheduleId,
      ok: false,
      error: WORKER_CANCELLED_ERROR,
      retryScheduled: false,
      attemptRefunded: false,
      cancelled: true
    };
  }

  async function settlePostExecutionCancellation(schedule) {
    await store.fail(schedule.scheduleId, { error: WORKER_CANCELLED_ERROR });
    return uncertainResult(schedule, { cancelled: true, retryScheduled: false });
  }

  async function executeClaimed(schedule, signal = null) {
    const agent = resolveAgent(registry, schedule.agentId);
    if (!agent) {
      await store.fail(schedule.scheduleId, { error: 'SCHEDULE_AGENT_NOT_FOUND' });
      return { scheduleId: schedule.scheduleId, ok: false, error: 'SCHEDULE_AGENT_NOT_FOUND' };
    }

    if (signal?.aborted) return settlePreExecutionCancellation(schedule);

    let result;
    try {
      const rawResult = await executeAgentTask({
        scheduleId: schedule.scheduleId,
        traceId: schedule.traceId,
        agent,
        task: schedule.task,
        attempt: schedule.attempts,
        signal
      });
      result = normalizeScheduleExecutionResult(rawResult);
    } catch {
      result = { ok: false, error: signal?.aborted ? WORKER_CANCELLED_ERROR : 'SCHEDULE_EXECUTION_FAILED' };
    }

    if (signal?.aborted) return settlePostExecutionCancellation(schedule);

    if (result.ok === true) {
      await store.complete(schedule.scheduleId);
      return { scheduleId: schedule.scheduleId, ok: true };
    }

    const error = result.contractInvalid === true
      ? SCHEDULE_EXECUTION_RESULT_INVALID
      : cleanErrorCode(result.error);
    if (error === WORKER_CANCELLED_ERROR) {
      const deferred = await deferWithoutAttempt(schedule, error);
      if (deferred) return { ...deferred, cancelled: true };
    }
    if (result.contractInvalid !== true && REFUNDABLE_INFRA_ERRORS.has(error) && typeof store.defer === 'function') {
      const retryAt = retryAtFromResult(result.retryAt, schedule);
      return deferWithoutAttempt(schedule, error, retryAt);
    }

    const canRetry = schedule.attempts < schedule.maxAttempts;
    if (canRetry) {
      const retryAt = new Date(currentDate().getTime() + scheduleRetryDelay(schedule)).toISOString();
      await store.fail(schedule.scheduleId, { error, retryAt });
    } else {
      await store.fail(schedule.scheduleId, { error });
    }
    return {
      scheduleId: schedule.scheduleId,
      ok: false,
      error,
      retryScheduled: canRetry,
      ...(result.contractInvalid === true ? { contractInvalid: true } : {})
    };
  }

  async function runDue({ limit = configuredBatchLimit, signal = null } = {}) {
    if (!validSignal(signal)) throw new Error('INVALID_SCHEDULE_WORKER:signal');
    const requestedLimit = normalizePositiveBoundedInteger(
      limit,
      configuredBatchLimit,
      MAX_BATCH_LIMIT,
      'limit'
    );
    const claimLimit = Math.min(requestedLimit, configuredBatchLimit);
    if (signal?.aborted) {
      return {
        claimed: 0,
        results: [],
        cancelled: true,
        uncertain: 0,
        limits: Object.freeze({ batch: configuredBatchLimit, concurrency: configuredConcurrency })
      };
    }
    const claimed = validateClaimedBatch(await store.claimDue({ limit: claimLimit }), claimLimit);
    const results = await mapWithConcurrency(
      claimed,
      configuredConcurrency,
      async (schedule) => {
        try {
          return await executeClaimed(schedule, signal);
        } catch {
          return uncertainResult(schedule);
        }
      }
    );
    return {
      claimed: claimed.length,
      results,
      cancelled: signal?.aborted === true,
      uncertain: results.filter((result) => result?.outcomeUnknown === true).length,
      invalidResults: results.filter((result) => result?.contractInvalid === true).length,
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

export {
  REFUNDABLE_INFRA_ERRORS,
  SCHEDULE_EXECUTION_RESULT_INVALID,
  WORKER_CANCELLED_ERROR,
  WORKER_STATE_UNCERTAIN_ERROR,
  mapWithConcurrency,
  normalizePositiveBoundedInteger,
  uncertainResult,
  validateClaimedBatch,
  validSignal
};
