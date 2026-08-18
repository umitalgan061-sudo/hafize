import assert from 'node:assert/strict';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

const NOW = new Date('2026-08-18T07:30:00.000Z');
const principal = { authenticated: true, subject: 'http-user' };
const agent = { id: 'minimal-engineer', name: 'Minimal Engineer' };
const store = createTaskScheduleStore({ now: () => new Date(NOW) });
let traceCalls = 0;

const commands = createScheduleCommandBoundary({
  store,
  registry: { agents: [agent] },
  now: () => new Date(NOW),
  createTraceId: () => `trace_http_${++traceCalls}`
});

const api = createScheduleHttpApi({
  authenticator: {
    authenticate: () => ({ ok: true, principal })
  },
  sessionAuthenticator: null,
  commands,
  readJson: async (request) => request?.body ?? {}
});

function post(body) {
  return api.handle({
    request: { body },
    method: 'POST',
    pathname: '/api/schedules',
    headers: { authorization: 'Bearer test' }
  });
}

function patch(scheduleId, body) {
  return api.handle({
    request: { body },
    method: 'PATCH',
    pathname: `/api/schedules/${encodeURIComponent(scheduleId)}`,
    headers: { authorization: 'Bearer test' }
  });
}

const past = await post({
  agentId: agent.id,
  task: 'Past HTTP task',
  runAt: '2026-08-18T07:29:59.000Z'
});
assert.equal(past.status, 400);
assert.deepEqual(past.body, { error: 'INVALID_SCHEDULE_COMMAND' });
assert.equal(traceCalls, 0);
assert.equal(store.snapshot().entries.length, 0);

const invalidAttempts = await post({
  agentId: agent.id,
  task: 'Invalid attempts',
  runAt: '2026-08-18T07:31:00.000Z',
  maxAttempts: 6
});
assert.equal(invalidAttempts.status, 400);
assert.deepEqual(invalidAttempts.body, { error: 'INVALID_SCHEDULE_COMMAND' });
assert.equal(traceCalls, 0);
assert.equal(store.snapshot().entries.length, 0);

const invalidAttemptsType = await post({
  agentId: agent.id,
  task: 'String attempts',
  runAt: '2026-08-18T07:31:00.000Z',
  maxAttempts: '2'
});
assert.equal(invalidAttemptsType.status, 400);
assert.equal(traceCalls, 0);

const created = await post({
  agentId: agent.id,
  task: 'Valid HTTP task',
  runAt: '2026-08-18T07:35:00.000Z',
  maxAttempts: 3,
  retryDelayMs: 60_000
});
assert.equal(created.status, 201);
assert.equal(created.body.ok, true);
assert.equal(created.body.schedule.maxAttempts, 3);
assert.equal(traceCalls, 1);

const scheduleId = created.body.schedule.scheduleId;
const beforePastPatch = store.read(scheduleId);
const pastPatch = await patch(scheduleId, { runAt: '2026-08-18T07:00:00.000Z' });
assert.equal(pastPatch.status, 400);
assert.deepEqual(pastPatch.body, { error: 'INVALID_SCHEDULE_COMMAND' });
assert.deepEqual(store.read(scheduleId), beforePastPatch);

const validPatch = await patch(scheduleId, { runAt: '2026-08-18T08:00:00.000Z' });
assert.equal(validPatch.status, 200);
assert.equal(validPatch.body.ok, true);
assert.equal(validPatch.body.schedule.runAt, '2026-08-18T08:00:00.000Z');

const retryOnly = await patch(scheduleId, { retryDelayMs: 15_000 });
assert.equal(retryOnly.status, 200);
assert.equal(retryOnly.body.schedule.retryDelayMs, 15_000);

console.log('schedule HTTP strict-input integration tests passed');
