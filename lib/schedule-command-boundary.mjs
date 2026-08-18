import { TASK_SCHEDULE_TIMING_LIMITS } from './task-schedule-store.mjs';

const CREATE_FIELDS = new Set(['agentId', 'task', 'runAt', 'maxAttempts', 'retryDelayMs']);
const RESCHEDULE_FIELDS = new Set(['runAt', 'retryDelayMs']);
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_TASK_LENGTH = 20_000;
const MAX_ATTEMPTS = 5;

function principalSubject(principal) {
  if (!principal || principal.authenticated !== true) return null;
  const subject = typeof principal.subject === 'string' ? principal.subject.trim() : '';
  return subject && subject.length <= 200 ? subject : null;
}

function publicSchedule(entry) {
  return {
    scheduleId: entry.scheduleId,
    traceId: entry.traceId,
    agentId: entry.agentId,
    task: entry.task,
    runAt: entry.runAt,
    status: entry.status,
    attempts: entry.attempts,
    maxAttempts: entry.maxAttempts,
    retryDelayMs: entry.retryDelayMs,
    lastError: entry.lastError,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

function fail(error) {
  return { ok: false, error };
}

function mapStoreError(error) {
  if (error?.message === 'TASK_SCHEDULE_FULL') return 'SCHEDULE_CAPACITY_REACHED';
  if (error?.message === 'TASK_SCHEDULE_NOT_RESCHEDULABLE') return 'SCHEDULE_NOT_RESCHEDULABLE';
  if (typeof error?.message === 'string' && error.message.startsWith('INVALID_TASK_SCHEDULE')) return 'INVALID_SCHEDULE';
  return 'SCHEDULE_COMMAND_FAILED';
}

function strictRunAt(value, nowMs) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > 64 || !RFC3339.test(text)) return null;
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || !Number.isFinite(nowMs) || parsed <= nowMs) return null;
  return text;
}

function strictRetryDelay(value) {
  if (value == null) return null;
  return Number.isSafeInteger(value)
    && value >= TASK_SCHEDULE_TIMING_LIMITS.minRetryDelayMs
    && value <= TASK_SCHEDULE_TIMING_LIMITS.maxRetryDelayMs
    ? value
    : null;
}

function strictTask(value) {
  const task = typeof value === 'string' ? value.trim() : '';
  return task && task.length <= MAX_TASK_LENGTH ? task : null;
}

function strictMaxAttempts(value) {
  if (value === undefined) return { ok: true, value: undefined };
  return Number.isSafeInteger(value) && value >= 1 && value <= MAX_ATTEMPTS
    ? { ok: true, value }
    : { ok: false, value: null };
}

function currentTimeMs(now) {
  let value;
  try {
    value = now();
  } catch {
    return null;
  }
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function validateTimingInput(input, { partial = false, nowMs = null } = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') return null;
  const allowed = partial ? RESCHEDULE_FIELDS : CREATE_FIELDS;
  for (const key of Object.keys(input)) if (!allowed.has(key)) return null;
  const hasRunAt = Object.hasOwn(input, 'runAt');
  const hasRetryDelay = Object.hasOwn(input, 'retryDelayMs');
  if ((!partial && !hasRunAt) || (partial && !hasRunAt && !hasRetryDelay)) return null;
  const runAt = hasRunAt ? strictRunAt(input.runAt, nowMs) : undefined;
  if (hasRunAt && !runAt) return null;
  const retryDelayMs = hasRetryDelay ? strictRetryDelay(input.retryDelayMs) : undefined;
  if (hasRetryDelay && retryDelayMs == null) return null;
  return { runAt, retryDelayMs };
}

export function createScheduleCommandBoundary({ store, registry, createTraceId, now = () => new Date() } = {}) {
  if (
    typeof store?.add !== 'function' || typeof store?.read !== 'function' ||
    typeof store?.snapshot !== 'function' || typeof store?.cancel !== 'function'
  ) throw new Error('INVALID_SCHEDULE_COMMAND_BOUNDARY:store');
  if (!Array.isArray(registry?.agents)) throw new Error('INVALID_SCHEDULE_COMMAND_BOUNDARY:registry');
  if (typeof createTraceId !== 'function') throw new Error('INVALID_SCHEDULE_COMMAND_BOUNDARY:createTraceId');
  if (typeof now !== 'function') throw new Error('INVALID_SCHEDULE_COMMAND_BOUNDARY:now');

  async function create({ principal, input } = {}) {
    const ownerId = principalSubject(principal);
    if (!ownerId) return fail('AUTH_REQUIRED');
    const nowMs = currentTimeMs(now);
    if (nowMs == null) return fail('SCHEDULE_COMMAND_FAILED');
    const timing = validateTimingInput(input, { nowMs });
    if (!timing) return fail('INVALID_SCHEDULE_COMMAND');

    const task = strictTask(input.task);
    const attempts = strictMaxAttempts(input.maxAttempts);
    if (!task || !attempts.ok) return fail('INVALID_SCHEDULE_COMMAND');

    const agentId = typeof input.agentId === 'string' ? input.agentId.trim() : '';
    const agent = registry.agents.find((item) => item?.id === agentId) || null;
    if (!agent) return fail('INVALID_AGENT');

    let traceId;
    try { traceId = createTraceId(); } catch { return fail('SCHEDULE_COMMAND_FAILED'); }
    if (typeof traceId !== 'string' || !traceId.trim()) return fail('SCHEDULE_COMMAND_FAILED');

    try {
      const schedule = await store.add({
        ownerId,
        traceId: traceId.trim(),
        agentId: agent.id,
        task,
        runAt: timing.runAt,
        ...(attempts.value === undefined ? {} : { maxAttempts: attempts.value }),
        ...(timing.retryDelayMs === undefined ? {} : { retryDelayMs: timing.retryDelayMs })
      });
      return { ok: true, schedule: publicSchedule(schedule) };
    } catch (error) {
      return fail(mapStoreError(error));
    }
  }

  async function list({ principal } = {}) {
    const ownerId = principalSubject(principal);
    if (!ownerId) return fail('AUTH_REQUIRED');
    try {
      const snapshot = await store.snapshot();
      return {
        ok: true,
        schedules: snapshot.entries.filter((entry) => entry.ownerId === ownerId).map(publicSchedule)
      };
    } catch {
      return fail('SCHEDULE_COMMAND_FAILED');
    }
  }

  async function ownedScheduled(ownerId, scheduleId, blockedError) {
    const id = typeof scheduleId === 'string' ? scheduleId.trim() : '';
    if (!id) return fail('INVALID_SCHEDULE_COMMAND');
    let current;
    try { current = await store.read(id); } catch { return fail('SCHEDULE_COMMAND_FAILED'); }
    if (!current || current.ownerId !== ownerId) return fail('SCHEDULE_NOT_FOUND');
    if (current.status !== 'scheduled') return fail(blockedError);
    return { ok: true, id };
  }

  async function reschedule({ principal, scheduleId, input } = {}) {
    const ownerId = principalSubject(principal);
    if (!ownerId) return fail('AUTH_REQUIRED');
    const hasRunAt = Boolean(input && !Array.isArray(input) && typeof input === 'object' && Object.hasOwn(input, 'runAt'));
    const nowMs = hasRunAt ? currentTimeMs(now) : 0;
    if (hasRunAt && nowMs == null) return fail('SCHEDULE_COMMAND_FAILED');
    const timing = validateTimingInput(input, { partial: true, nowMs });
    if (!timing) return fail('INVALID_SCHEDULE_COMMAND');
    const owned = await ownedScheduled(ownerId, scheduleId, 'SCHEDULE_NOT_RESCHEDULABLE');
    if (!owned.ok) return owned;
    if (typeof store?.reschedule !== 'function') return fail('SCHEDULE_COMMAND_FAILED');

    try {
      const schedule = await store.reschedule(owned.id, {
        ...(timing.runAt === undefined ? {} : { runAt: timing.runAt }),
        ...(timing.retryDelayMs === undefined ? {} : { retryDelayMs: timing.retryDelayMs })
      });
      return { ok: true, schedule: publicSchedule(schedule) };
    } catch (error) {
      return fail(mapStoreError(error));
    }
  }

  async function cancel({ principal, scheduleId } = {}) {
    const ownerId = principalSubject(principal);
    if (!ownerId) return fail('AUTH_REQUIRED');
    const owned = await ownedScheduled(ownerId, scheduleId, 'SCHEDULE_NOT_CANCELLABLE');
    if (!owned.ok) return owned;
    try {
      const schedule = await store.cancel(owned.id);
      return { ok: true, schedule: publicSchedule(schedule) };
    } catch {
      return fail('SCHEDULE_COMMAND_FAILED');
    }
  }

  return Object.freeze({ create, list, reschedule, cancel });
}

export {
  MAX_ATTEMPTS as SCHEDULE_COMMAND_MAX_ATTEMPTS,
  MAX_TASK_LENGTH as SCHEDULE_COMMAND_MAX_TASK_LENGTH,
  currentTimeMs,
  strictMaxAttempts,
  strictRunAt,
  strictTask,
  validateTimingInput
};
