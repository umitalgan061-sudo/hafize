const CREATE_FIELDS = new Set(['agentId', 'task', 'runAt', 'maxAttempts']);
const RESCHEDULE_FIELDS = new Set(['runAt']);

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
    lastError: entry.lastError,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

function fail(error) { return { ok: false, error }; }

function mapStoreError(error) {
  if (error?.message === 'TASK_SCHEDULE_FULL') return 'SCHEDULE_CAPACITY_REACHED';
  if (typeof error?.message === 'string' && error.message.startsWith('INVALID_TASK_SCHEDULE')) return 'INVALID_SCHEDULE';
  return 'SCHEDULE_COMMAND_FAILED';
}

export function createScheduleCommandBoundary({ store, registry, createTraceId } = {}) {
  if (
    typeof store?.add !== 'function' || typeof store?.read !== 'function' ||
    typeof store?.snapshot !== 'function' || typeof store?.reschedule !== 'function' ||
    typeof store?.cancel !== 'function'
  ) throw new Error('INVALID_SCHEDULE_COMMAND_BOUNDARY:store');
  if (!Array.isArray(registry?.agents)) throw new Error('INVALID_SCHEDULE_COMMAND_BOUNDARY:registry');
  if (typeof createTraceId !== 'function') throw new Error('INVALID_SCHEDULE_COMMAND_BOUNDARY:createTraceId');

  async function create({ principal, input } = {}) {
    const ownerId = principalSubject(principal);
    if (!ownerId) return fail('AUTH_REQUIRED');
    if (!input || Array.isArray(input) || typeof input !== 'object') return fail('INVALID_SCHEDULE_COMMAND');
    for (const key of Object.keys(input)) if (!CREATE_FIELDS.has(key)) return fail('INVALID_SCHEDULE_COMMAND');

    const agentId = typeof input.agentId === 'string' ? input.agentId.trim() : '';
    const agent = registry.agents.find((item) => item?.id === agentId) || null;
    if (!agent) return fail('INVALID_AGENT');

    let traceId;
    try { traceId = createTraceId(); } catch { return fail('SCHEDULE_COMMAND_FAILED'); }
    if (typeof traceId !== 'string' || !traceId.trim()) return fail('SCHEDULE_COMMAND_FAILED');

    try {
      const schedule = await store.add({
        ownerId, traceId: traceId.trim(), agentId: agent.id,
        task: input.task, runAt: input.runAt, maxAttempts: input.maxAttempts
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

  async function ownedScheduled(ownerId, scheduleId) {
    const id = typeof scheduleId === 'string' ? scheduleId.trim() : '';
    if (!id) return { error: 'INVALID_SCHEDULE_COMMAND' };
    let current;
    try { current = await store.read(id); } catch { return { error: 'SCHEDULE_COMMAND_FAILED' }; }
    if (!current || current.ownerId !== ownerId) return { error: 'SCHEDULE_NOT_FOUND' };
    if (current.status !== 'scheduled') return { error: 'SCHEDULE_NOT_MUTABLE' };
    return { id };
  }

  async function reschedule({ principal, scheduleId, input } = {}) {
    const ownerId = principalSubject(principal);
    if (!ownerId) return fail('AUTH_REQUIRED');
    if (!input || Array.isArray(input) || typeof input !== 'object') return fail('INVALID_SCHEDULE_COMMAND');
    for (const key of Object.keys(input)) if (!RESCHEDULE_FIELDS.has(key)) return fail('INVALID_SCHEDULE_COMMAND');
    if (Object.keys(input).length !== 1) return fail('INVALID_SCHEDULE_COMMAND');

    const owned = await ownedScheduled(ownerId, scheduleId);
    if (owned.error) return fail(owned.error);
    try {
      const schedule = await store.reschedule(owned.id, { runAt: input.runAt });
      return { ok: true, schedule: publicSchedule(schedule) };
    } catch (error) {
      return fail(mapStoreError(error));
    }
  }

  async function cancel({ principal, scheduleId } = {}) {
    const ownerId = principalSubject(principal);
    if (!ownerId) return fail('AUTH_REQUIRED');
    const owned = await ownedScheduled(ownerId, scheduleId);
    if (owned.error === 'SCHEDULE_NOT_MUTABLE') return fail('SCHEDULE_NOT_CANCELLABLE');
    if (owned.error) return fail(owned.error);
    try {
      const schedule = await store.cancel(owned.id);
      return { ok: true, schedule: publicSchedule(schedule) };
    } catch {
      return fail('SCHEDULE_COMMAND_FAILED');
    }
  }

  return Object.freeze({ create, list, reschedule, cancel });
}
