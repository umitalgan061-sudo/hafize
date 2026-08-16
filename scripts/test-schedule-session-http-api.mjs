import assert from 'node:assert/strict';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

function createCommands(log) {
  return {
    async list({ principal }) {
      log.push(['list', principal.subject]);
      return { ok: true, schedules: [{ scheduleId: 's1', owner: principal.subject }] };
    },
    async create({ principal, input }) {
      log.push(['create', principal.subject, input]);
      return { ok: true, schedule: { scheduleId: 's2', owner: principal.subject } };
    },
    async reschedule({ principal, scheduleId, input }) {
      log.push(['reschedule', principal.subject, scheduleId, input]);
      return { ok: true, schedule: { scheduleId, owner: principal.subject } };
    },
    async cancel({ principal, scheduleId }) {
      log.push(['cancel', principal.subject, scheduleId]);
      return { ok: true, schedule: { scheduleId, owner: principal.subject } };
    }
  };
}

const bearer = {
  authenticate({ headers }) {
    return headers?.authorization === 'Bearer api-good'
      ? { ok: true, principal: Object.freeze({ authenticated: true, subject: 'api-owner' }) }
      : { ok: false, error: 'AUTH_REQUIRED' };
  }
};
const session = {
  authenticate({ headers }) {
    return headers?.cookie === '__Host-hafize_session=web-good'
      ? { ok: true, principal: Object.freeze({ authenticated: true, subject: 'web-owner' }), expiresAt: 999999 }
      : { ok: false, error: 'AUTH_REQUIRED' };
  }
};

let readBodies = [];
const readJson = async (request) => {
  readBodies.push(request);
  return request?.json ?? {};
};
const log = [];
const api = createScheduleHttpApi({ authenticator: bearer, sessionAuthenticator: session, commands: createCommands(log), readJson });

let response = await api.handle({ method: 'GET', pathname: '/api/schedules', headers: { cookie: '__Host-hafize_session=web-good' } });
assert.equal(response.status, 200);
assert.equal(response.body.ok, true);
assert.equal(response.body.schedules[0].owner, 'web-owner');
assert.deepEqual(log.at(-1), ['list', 'web-owner']);

response = await api.handle({ method: 'GET', pathname: '/api/schedules', headers: { authorization: 'Bearer api-good', cookie: '__Host-hafize_session=web-good' } });
assert.equal(response.status, 200);
assert.equal(response.body.schedules[0].owner, 'api-owner');
assert.deepEqual(log.at(-1), ['list', 'api-owner']);

response = await api.handle({
  request: { json: { agentId: 'minimal-engineer', task: 'Günlük özeti hazırla', runAt: '2030-01-01T09:00:00.000Z' } },
  method: 'POST',
  pathname: '/api/schedules',
  headers: { cookie: '__Host-hafize_session=web-good' }
});
assert.equal(response.status, 201);
assert.deepEqual(log.at(-1), ['create', 'web-owner', { agentId: 'minimal-engineer', task: 'Günlük özeti hazırla', runAt: '2030-01-01T09:00:00.000Z' }]);
assert.equal(readBodies.length, 1);

response = await api.handle({
  request: { json: { runAt: '2030-01-02T10:00:00.000Z' } },
  method: 'PATCH',
  pathname: '/api/schedules/schedule-1',
  headers: { cookie: '__Host-hafize_session=web-good' }
});
assert.equal(response.status, 200);
assert.deepEqual(log.at(-1), ['reschedule', 'web-owner', 'schedule-1', { runAt: '2030-01-02T10:00:00.000Z' }]);

response = await api.handle({
  method: 'DELETE',
  pathname: '/api/schedules/schedule-1',
  headers: { cookie: '__Host-hafize_session=web-good' }
});
assert.equal(response.status, 200);
assert.deepEqual(log.at(-1), ['cancel', 'web-owner', 'schedule-1']);

const beforeUnauthorized = log.length;
response = await api.handle({ method: 'GET', pathname: '/api/schedules', headers: {} });
assert.equal(response.status, 401);
assert.deepEqual(response.body, { error: 'AUTH_REQUIRED' });
assert.equal(response.headers['WWW-Authenticate'], 'Bearer');
assert.equal(log.length, beforeUnauthorized, 'unauthenticated request must not reach commands');

response = await api.handle({ method: 'GET', pathname: '/api/not-schedules', headers: { cookie: '__Host-hafize_session=web-good' } });
assert.deepEqual(response, { matched: false });
response = await api.handle({ method: 'GET', pathname: '/api/schedules/', headers: { cookie: '__Host-hafize_session=web-good' } });
assert.equal(response.status, 404);
response = await api.handle({ method: 'GET', pathname: '/api/schedules/a/b', headers: { cookie: '__Host-hafize_session=web-good' } });
assert.equal(response.status, 404);

response = await api.handle({ method: 'PUT', pathname: '/api/schedules', headers: { cookie: '__Host-hafize_session=web-good' } });
assert.equal(response.status, 405);
assert.equal(response.headers.Allow, 'GET, POST');
response = await api.handle({ method: 'POST', pathname: '/api/schedules/schedule-1', headers: { cookie: '__Host-hafize_session=web-good' } });
assert.equal(response.status, 405);
assert.equal(response.headers.Allow, 'PATCH, DELETE');

const bearerOnlyLog = [];
const bearerOnly = createScheduleHttpApi({ authenticator: bearer, sessionAuthenticator: null, commands: createCommands(bearerOnlyLog), readJson });
response = await bearerOnly.handle({ method: 'GET', pathname: '/api/schedules', headers: { authorization: 'Bearer api-good' } });
assert.equal(response.status, 200);
assert.deepEqual(bearerOnlyLog, [['list', 'api-owner']]);
response = await bearerOnly.handle({ method: 'GET', pathname: '/api/schedules', headers: { cookie: '__Host-hafize_session=web-good' } });
assert.equal(response.status, 401);

const throwingSession = createScheduleHttpApi({
  authenticator: bearer,
  sessionAuthenticator: { authenticate() { throw new Error('do not expose this'); } },
  commands: createCommands([]),
  readJson
});
response = await throwingSession.handle({ method: 'GET', pathname: '/api/schedules', headers: {} });
assert.equal(response.status, 401);
assert.deepEqual(response.body, { error: 'AUTH_REQUIRED' });
assert.equal(JSON.stringify(response).includes('do not expose this'), false);

assert.throws(
  () => createScheduleHttpApi({ authenticator: bearer, sessionAuthenticator: {}, commands: createCommands([]), readJson }),
  /INVALID_SCHEDULE_HTTP_API:sessionAuthenticator/
);

console.log('schedule session HTTP API tests passed');
