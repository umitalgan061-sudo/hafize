import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

const store = createTaskScheduleStore({ now: () => new Date('2026-09-16T06:00:00.000Z') });
const registry = { agents: [{ id: 'hafize-general' }] };
const commands = createScheduleCommandBoundary({ store, registry, createTraceId: () => 'trace-stats' });
const api = createScheduleHttpApi({
  authenticator: { authenticate: ({ headers }) => headers?.authorization === 'Bearer ok' ? { ok: true, principal: { authenticated: true, subject: 'alice' } } : { ok: false } },
  commands,
  readJson: async (request) => request.body ? JSON.parse(request.body) : {}
});

for (let index = 0; index < 4; index += 1) {
  await commands.create({ principal: { authenticated: true, subject: 'alice' }, input: { agentId: 'hafize-general', task: `stat ${index}`, runAt: '2026-09-17T06:00:00Z' } });
}

const stats = await api.handle({ request: { url: '/api/schedules/stats' }, method: 'GET', pathname: '/api/schedules/stats', headers: { authorization: 'Bearer ok' } });
assert.equal(stats.status, 200);
assert.equal(stats.body.ok, true);
assert.equal(stats.body.stats.total, 4);
assert.equal(stats.body.stats.capacity, 'unbounded');
assert.equal(stats.headers['Cache-Control'], undefined);

const unauthorized = await api.handle({ request: { url: '/api/schedules/stats' }, method: 'GET', pathname: '/api/schedules/stats', headers: {} });
assert.equal(unauthorized.status, 401);
assert.equal(unauthorized.body.code, 'AUTH_REQUIRED');

const wrongVerb = await api.handle({ request: { url: '/api/schedules/stats' }, method: 'POST', pathname: '/api/schedules/stats', headers: { authorization: 'Bearer ok' } });
assert.equal(wrongVerb.status, 405);
assert.equal(wrongVerb.headers.Allow, 'GET');

console.log('schedule stats HTTP tests passed');
