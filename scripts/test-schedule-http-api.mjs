import assert from 'node:assert/strict';
import { createBearerPrincipalAuthenticator } from '../lib/server-auth.mts';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mts';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mts';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mts';
import { expectMatched } from './expect-result.mjs';

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

const requestId = 'req-schedule-1';
const unauthorized = await api.handle({
  request: { body: { agentId: 'hafize-general' } },
  method: 'POST',
  pathname: '/api/schedules',
  headers: { 'x-hafize-request-id': requestId }
});
assert.equal(expectMatched(unauthorized).status, 401);
assert.deepEqual(expectMatched(unauthorized).body, { error: 'AUTH_REQUIRED', status: 401, message: '', requestId });
assert.equal(expectMatched(unauthorized).headers['WWW-Authenticate'], 'Bearer');
assert.equal(expectMatched(unauthorized).headers['X-Hafize-Request-Id'], requestId);
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
  headers: { authorization: `Bearer ${token}`, 'x-hafize-request-id': requestId }
});
assert.equal(expectMatched(created).status, 201);
assert.equal(expectMatched(created).body.ok, true);
assert.equal(expectMatched(created).body.schedule.traceId, 'trace-http-1');
assert.equal('ownerId' in expectMatched(created).body.schedule, false);
assert.equal(bodyReads, 1);

const listed = await api.handle({
  method: 'GET',
  pathname: '/api/schedules',
  headers: { authorization: `Bearer ${token}` }
});
assert.equal(expectMatched(listed).status, 200);
assert.equal(expectMatched(listed).body.schedules.length, 1);
assert.equal(expectMatched(listed).body.schedules[0].scheduleId, expectMatched(created).body.schedule.scheduleId);
assert.equal(JSON.stringify(expectMatched(listed).body).includes('user-1'), false);

const invalidAgent = await api.handle({
  request: { body: { agentId: 'missing', task: 'x', runAt: '2026-08-12T13:00:00.000Z' } },
  method: 'POST',
  pathname: '/api/schedules',
  headers: { authorization: `Bearer ${token}`, 'x-hafize-request-id': requestId }
});
assert.equal(expectMatched(invalidAgent).status, 400);
assert.deepEqual(expectMatched(invalidAgent).body, { error: 'INVALID_AGENT', status: 400, message: '', requestId });

const wrongMethod = await api.handle({
  method: 'PUT',
  pathname: '/api/schedules',
  headers: { authorization: `Bearer ${token}`, 'x-hafize-request-id': requestId }
});
assert.equal(expectMatched(wrongMethod).status, 405);
assert.deepEqual(expectMatched(wrongMethod).body, { error: 'INVALID_SCHEDULE_COMMAND', status: 405, message: '', requestId });
assert.equal(expectMatched(wrongMethod).headers.Allow, 'GET, POST');

const cancelled = await api.handle({
  method: 'DELETE',
  pathname: `/api/schedules/${encodeURIComponent(expectMatched(created).body.schedule.scheduleId)}`,
  headers: { authorization: `Bearer ${token}` }
});
assert.equal(expectMatched(cancelled).status, 200);
assert.equal(expectMatched(cancelled).body.schedule.status, 'cancelled');

const repeatedCancel = await api.handle({
  method: 'DELETE',
  pathname: `/api/schedules/${expectMatched(created).body.schedule.scheduleId}`,
  headers: { authorization: `Bearer ${token}`, 'x-hafize-request-id': requestId }
});
assert.equal(expectMatched(repeatedCancel).status, 409);
assert.deepEqual(expectMatched(repeatedCancel).body, { error: 'SCHEDULE_NOT_CANCELLABLE', status: 409, message: '', requestId });

const malformedPath = await api.handle({
  method: 'DELETE',
  pathname: '/api/schedules/a/b',
  headers: { authorization: `Bearer ${token}` }
});
assert.equal(expectMatched(malformedPath).status, 404);
assert.equal(expectMatched(malformedPath).body.error, 'SCHEDULE_NOT_FOUND');
assert.equal(expectMatched(malformedPath).body.status, 404);

const unmatched = await api.handle({ method: 'GET', pathname: '/api/other', headers: {} });
assert.equal(unmatched.matched, false);

console.log('schedule http api tests passed');
