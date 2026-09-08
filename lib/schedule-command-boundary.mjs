import { containsPlaintextCredential } from './plaintext-credential-policy.mjs';

const CREATE_FIELDS = new Set(['agentId', 'task', 'runAt', 'maxAttempts']);

function principalSubject(principal) {
  if (!principal || principal.authenticated !== true) return null;
  const subject = typeof principal.subject === 'string' ? principal.subject.trim() : '';
  return subject && subject.length <= 200 ? subject : null;
}

function publicSchedule(entry) {
  return { scheduleId: entry.scheduleId, traceId: entry.traceId, agentId: entry.agentId, task: entry.task, runAt: entry.runAt, status: entry.status, attempts: entry.attempts, maxAttempts: entry.maxAttempts, lastError: entry.lastError, createdAt: entry.createdAt, updatedAt: entry.updatedAt };
}

function fail(error) { return { ok: false, error }; }

function mapStoreError(error) {
  if (error?.message === 'TASK_SCHEDULE_FULL') return 'SCHEDULE_CAPACITY_REACHED';
  if (typeof error?.message === 'string' && error.message.startsWith('INVALID_TASK_SCHEDULE')) return 'INVALID_SCHEDULE';
  return 'SCHEDULE_COMMAND_FAILED';
}

export function createScheduleCommandBoundary({ store, registry, createTraceId } = {}) {
  if (typeof store?.add !== 'function' || typeof store?.read !== 'function' || typeof store?.snapshot !== 'function' || typeof store?.cancel !== 'function') throw new Error('INVALID_SCHEDULE_COMMAND_BOUNDARY:store');
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
    const task = typeof input.task === 'string' ? input.task.trim() : '';
    if (!task || task.length > 20_000) return fail('INVALID_SCHEDULE_COMMAND');
    if (containsPlaintextCredential(task)) return fail('SCHEDULE_TASK_CREDENTIAL_NOT_ALLOWED');

    let traceId;
    try { traceId = createTraceId(); } catch { return fail('SCHEDULE_COMMAND_FAILED'); }
    if (typeof traceId !== 'string' || !traceId.trim()) return fail('SCHEDULE_COMMAND_FAILED');

    try { return { ok: true, schedule: publicSchedule(await store.add({ ownerId, traceId: traceId.trim(), agentId: agent.id, task, runAt: input.runAt, maxAttempts: input.maxAttempts })) }; }
    catch (error) { return fail(mapStoreError(error)); }
  }

  async function list({ principal } = {}) {
    const ownerId = principalSubject(principal);
    if (!ownerId) return fail('AUTH_REQUIRED');
    try { return { ok: true, schedules: (await store.snapshot()).entries.filter((entry) => entry.ownerId === ownerId).map(publicSchedule) }; }
    catch { return fail('SCHEDULE_COMMAND_FAILED'); }
  }

  async function cancel({ principal, scheduleId } = {}) {
    const ownerId = principalSubject(principal);
    if (!ownerId) return fail('AUTH_REQUIRED');
    const id = typeof scheduleId === 'string' ? scheduleId.trim() : '';
    if (!id) return fail('INVALID_SCHEDULE_COMMAND');
    let current;
    try { current = await store.read(id); } catch { return fail('SCHEDULE_COMMAND_FAILED'); }
    if (!current || current.ownerId !== ownerId) return fail('SCHEDULE_NOT_FOUND');
    if (current.status !== 'scheduled') return fail('SCHEDULE_NOT_CANCELLABLE');
    try { return { ok: true, schedule: publicSchedule(await store.cancel(id)) }; }
    catch { return fail('SCHEDULE_COMMAND_FAILED'); }
  }

  return Object.freeze({ create, list, cancel });
}
