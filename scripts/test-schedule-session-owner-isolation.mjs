import assert from 'node:assert/strict';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

const entries = [
  {
    scheduleId: 'alice-1', ownerId: 'alice', traceId: 't1', agentId: 'minimal-engineer', task: 'Alice task',
    runAt: '2030-01-01T09:00:00.000Z', status: 'scheduled', attempts: 0, maxAttempts: 3, retryDelayMs: 60000,
    lastError: null, createdAt: '2029-01-01T00:00:00.000Z', updatedAt: '2029-01-01T00:00:00.000Z'
  },
  {
    scheduleId: 'bob-1', ownerId: 'bob', traceId: 't2', agentId: 'minimal-engineer', task: 'Bob task',
    runAt: '2030-01-02T09:00:00.000Z', status: 'scheduled', attempts: 0, maxAttempts: 3, retryDelayMs: 60000,
    lastError: null, createdAt: '2029-01-01T00:00:00.000Z', updatedAt: '2029-01-01T00:00:00.000Z'
  }
];

const store = {
  async snapshot() { return { entries: entries.map((entry) => ({ ...entry })) }; },
  async read(id) { return entries.find((entry) => entry.scheduleId === id) || null; },
  async add(input) {
    const entry = {
      scheduleId: `${input.ownerId}-new`, ownerId: input.ownerId, traceId: input.traceId, agentId: input.agentId,
      task: input.task, runAt: input.runAt, status: 'scheduled', attempts: 0, maxAttempts: input.maxAttempts || 3,
      retryDelayMs: input.retryDelayMs || 60000, lastError: null, createdAt: '2029-01-01T00:00:00.000Z', updatedAt: '2029-01-01T00:00:00.000Z'
    };
    entries.push(entry);
    return { ...entry };
  },
  async reschedule(id, patch) {
    const entry = entries.find((item) => item.scheduleId === id);
    Object.assign(entry, patch, { updatedAt: '2029-01-02T00:00:00.000Z' });
    return { ...entry };
  },
  async cancel(id) {
    const entry = entries.find((item) => item.scheduleId === id);
    entry.status = 'cancelled';
    entry.updatedAt = '2029-01-02T00:00:00.000Z';
    return { ...entry };
  }
};
const commands = createScheduleCommandBoundary({
  store,
  registry: { agents: [{ id: 'minimal-engineer' }] },
  createTraceId: () => 'trace-new'
});
const bearer = { authenticate() { return { ok: false, error: 'AUTH_REQUIRED' }; } };
const session = {
  authenticate({ headers }) {
    const subject = headers?.cookie === 'session=alice' ? 'alice' : headers?.cookie === 'session=bob' ? 'bob' : '';
    return subject
      ? { ok: true, principal: Object.freeze({ authenticated: true, subject }) }
      : { ok: false, error: 'AUTH_REQUIRED' };
  }
};
const api = createScheduleHttpApi({
  authenticator: bearer,
  sessionAuthenticator: session,
  commands,
  readJson: async (request) => request.body
});

let response = await api.handle({ method: 'GET', pathname: '/api/schedules', headers: { cookie: 'session=alice' } });
assert.equal(response.status, 200);
assert.deepEqual(response.body.schedules.map((item) => item.scheduleId), ['alice-1']);
assert.equal(JSON.stringify(response.body).includes('Bob task'), false);

response = await api.handle({ method: 'GET', pathname: '/api/schedules', headers: { cookie: 'session=bob' } });
assert.equal(response.status, 200);
assert.deepEqual(response.body.schedules.map((item) => item.scheduleId), ['bob-1']);
assert.equal(JSON.stringify(response.body).includes('Alice task'), false);

response = await api.handle({
  request: { body: { runAt: '2031-01-01T09:00:00.000Z' } },
  method: 'PATCH', pathname: '/api/schedules/bob-1', headers: { cookie: 'session=alice' }
});
assert.equal(response.status, 404, 'Alice must not learn whether Bob schedule exists');
assert.deepEqual(response.body, { error: 'SCHEDULE_NOT_FOUND' });

response = await api.handle({ method: 'DELETE', pathname: '/api/schedules/bob-1', headers: { cookie: 'session=alice' } });
assert.equal(response.status, 404);
assert.equal(entries.find((item) => item.scheduleId === 'bob-1').status, 'scheduled');

response = await api.handle({
  request: { body: { agentId: 'minimal-engineer', task: 'Alice second task', runAt: '2030-03-01T10:00:00.000Z' } },
  method: 'POST', pathname: '/api/schedules', headers: { cookie: 'session=alice' }
});
assert.equal(response.status, 201);
assert.equal(response.body.schedule.scheduleId, 'alice-new');

response = await api.handle({ method: 'GET', pathname: '/api/schedules', headers: { cookie: 'session=bob' } });
assert.deepEqual(response.body.schedules.map((item) => item.scheduleId), ['bob-1']);
assert.equal(JSON.stringify(response.body).includes('Alice second task'), false);

console.log('schedule cloud-session owner isolation tests passed');
