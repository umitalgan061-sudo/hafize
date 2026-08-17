import assert from 'node:assert/strict';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

const origin = 'https://hafize.example';
let readCalls = 0;
const calls = [];
const sessionAuthenticator = {
  allowedOrigin: origin,
  authenticate({ headers }) {
    return headers?.cookie === '__Host-hafize_session=session'
      ? { ok: true, principal: { authenticated: true, subject: 'user:schedule' } }
      : { ok: false, error: 'AUTH_REQUIRED' };
  }
};
const bearerAuthenticator = {
  authenticate({ headers }) {
    return headers?.authorization === 'Bearer scheduler'
      ? { ok: true, principal: { authenticated: true, subject: 'service:scheduler' } }
      : { ok: false, error: 'AUTH_REQUIRED' };
  }
};
const commands = {
  async list({ principal }) {
    calls.push(['list', principal.subject]);
    return { ok: true, schedules: [] };
  },
  async create({ principal, input }) {
    calls.push(['create', principal.subject, input]);
    return { ok: true, schedule: { id: 'sch_1' } };
  },
  async reschedule({ principal, scheduleId, input }) {
    calls.push(['reschedule', principal.subject, scheduleId, input]);
    return { ok: true, schedule: { id: scheduleId } };
  },
  async cancel({ principal, scheduleId }) {
    calls.push(['cancel', principal.subject, scheduleId]);
    return { ok: true, schedule: { id: scheduleId, status: 'cancelled' } };
  }
};
const api = createScheduleHttpApi({
  authenticator: bearerAuthenticator,
  sessionAuthenticator,
  commands,
  async readJson(request) {
    readCalls += 1;
    return request.body;
  }
});
const cookie = '__Host-hafize_session=session';

// GET remains a read-only cookie fallback and does not need a mutation Origin header.
const list = await api.handle({ method: 'GET', pathname: '/api/schedules', headers: { cookie } });
assert.equal(list.status, 200);
assert.deepEqual(calls.shift(), ['list', 'user:schedule']);

// Cookie-backed state changes are denied before body parsing when Origin is absent/foreign.
const deniedCreate = await api.handle({
  request: { body: { agentId: 'minimal-engineer' } },
  method: 'POST',
  pathname: '/api/schedules',
  headers: { cookie }
});
assert.equal(deniedCreate.status, 401);
assert.equal(readCalls, 0);
assert.equal(calls.length, 0);
const foreignCreate = await api.handle({
  request: { body: { agentId: 'minimal-engineer' } },
  method: 'POST',
  pathname: '/api/schedules',
  headers: { cookie, origin: 'https://evil.example' }
});
assert.equal(foreignCreate.status, 401);
assert.equal(readCalls, 0);
assert.equal(calls.length, 0);

const created = await api.handle({
  request: { body: { agentId: 'minimal-engineer' } },
  method: 'POST',
  pathname: '/api/schedules',
  headers: { cookie, origin }
});
assert.equal(created.status, 201);
assert.equal(readCalls, 1);
assert.deepEqual(calls.shift(), ['create', 'user:schedule', { agentId: 'minimal-engineer' }]);

const patched = await api.handle({
  request: { body: { runAt: '2030-01-01T00:00:00.000Z' } },
  method: 'PATCH',
  pathname: '/api/schedules/sch_1',
  headers: { cookie, origin }
});
assert.equal(patched.status, 200);
assert.deepEqual(calls.shift(), [
  'reschedule',
  'user:schedule',
  'sch_1',
  { runAt: '2030-01-01T00:00:00.000Z' }
]);

const cancelled = await api.handle({
  method: 'DELETE',
  pathname: '/api/schedules/sch_1',
  headers: { cookie, origin }
});
assert.equal(cancelled.status, 200);
assert.deepEqual(calls.shift(), ['cancel', 'user:schedule', 'sch_1']);

// Server-to-server bearer mutations do not acquire a browser Origin requirement.
const bearerCreate = await api.handle({
  request: { body: { agentId: 'minimal-engineer' } },
  method: 'POST',
  pathname: '/api/schedules',
  headers: { authorization: 'Bearer scheduler', origin: 'https://evil.example' }
});
assert.equal(bearerCreate.status, 201);
assert.deepEqual(calls.shift(), ['create', 'service:scheduler', { agentId: 'minimal-engineer' }]);

// Malformed target IDs remain hidden behind the existing 404 boundary.
const badPath = await api.handle({ method: 'DELETE', pathname: '/api/schedules/%2F', headers: { cookie, origin } });
assert.equal(badPath.status, 404);
assert.deepEqual(badPath.body, { error: 'SCHEDULE_NOT_FOUND' });
assert.equal(calls.length, 0);

console.log('schedule cloud origin HTTP tests passed');
