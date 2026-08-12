import assert from 'node:assert/strict';
import { createBearerPrincipalAuthenticator } from '../lib/server-auth.mjs';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

const token = 'a'.repeat(48);
const store = createTaskScheduleStore({ now: () => new Date('2026-08-12T12:00:00.000Z') });
const registry = { agents: [{ id: 'hafize-general', name: 'Hafize' }] };
let traceCounter = 0;
const commands = createScheduleCommandBoundary({
  store,
  registry,
  createTraceId: () => `trace-http-${++traceCounter}`
});
const authenticator = createBearerPrincipalAuthenticator({ token, subject: 'user-1' });
let bodyReads = 0;
const api = createScheduleHttpApi({
  authenticator,
  commands,
  async readJson(request) {
    bodyReads += 1;
    return request?.body ?? {};
  }
});

const unauthorized = await api.handle({
  request: { body: { agentId: 'hafize-general' } },
  method: 'POST',
  pathname: '/api/schedules',
  headers: {}
});
assert.equal(unauthorized.status, 401);
assert.equal(unauthorized.body.error, 'AUTH_REQUIRED');
assert.equal(unauthorized.headers['WWW-Authenticate'], 'Bearer');
assert.equal(bodyReads, 0, 'unauthorized request body must not be read');

const created = await api.handle({
  request: {
    body: {
      agentId: 'hafize-general',
      task: 'Saatlik özeti hazırla.',
      runAt: '2026-08-12T13:00:00.000Z',
      maxAttempts: 2
    }
  },
  method: 'POST',
  pathname: '/api/schedules',
  headers: { authorization: `Bearer ${token}` }
});
assert.equal(created.status, 201);
assert.equal(created.body.ok, true);
assert.equal(created.body.schedule.traceId, 'trace-http-1');
assert.equal('ownerId' in created.body.schedule, false);
assert.equal(bodyReads, 1);

const listed = await api.handle({
  method: 'GET',
  pathname: '/api/schedules',
  headers: { authorization: `Bearer ${token}` }
});
assert.equal(listed.status, 200);
assert.equal(listed.body.schedules.length, 1);
assert.equal(listed.body.schedules[0].scheduleId, created.body.schedule.scheduleId);
assert.equal(JSON.stringify(listed.body).includes('user-1'), false);

const invalidAgent = await api.handle({
  request: { body: { agentId: 'missing', task: 'x', runAt: '2026-08-12T13:00:00.000Z' } },
  method: 'POST',
  pathname: '/api/schedules',
  headers: { authorization: `Bearer ${token}` }
});
assert.equal(invalidAgent.status, 400);
assert.equal(invalidAgent.body.error, 'INVALID_AGENT');

const wrongMethod = await api.handle({
  method: 'PUT',
  pathname: '/api/schedules',
  headers: { authorization: `Bearer ${token}` }
});
assert.equal(wrongMethod.status, 405);
assert.equal(wrongMethod.headers.Allow, 'GET, POST');

const cancelled = await api.handle({
  method: 'DELETE',
  pathname: `/api/schedules/${encodeURIComponent(created.body.schedule.scheduleId)}`,
  headers: { authorization: `Bearer ${token}` }
});
assert.equal(cancelled.status, 200);
assert.equal(cancelled.body.schedule.status, 'cancelled');

const repeatedCancel = await api.handle({
  method: 'DELETE',
  pathname: `/api/schedules/${created.body.schedule.scheduleId}`,
  headers: { authorization: `Bearer ${token}` }
});
assert.equal(repeatedCancel.status, 409);
assert.equal(repeatedCancel.body.error, 'SCHEDULE_NOT_CANCELLABLE');

const malformedPath = await api.handle({
  method: 'DELETE',
  pathname: '/api/schedules/a/b',
  headers: { authorization: `Bearer ${token}` }
});
assert.equal(malformedPath.status, 404);

const unmatched = await api.handle({ method: 'GET', pathname: '/api/other', headers: {} });
assert.equal(unmatched.matched, false);

console.log('schedule http api tests passed');
