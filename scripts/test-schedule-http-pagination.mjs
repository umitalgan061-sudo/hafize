import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

const now = () => new Date('2026-09-16T06:00:00.000Z');
const store = createTaskScheduleStore({ now });
const registry = { agents: [{ id: 'hafize-general' }] };
let trace = 0;
const commands = createScheduleCommandBoundary({ store, registry, createTraceId: () => `trace-${++trace}` });
const alice = { authenticated: true, subject: 'alice' };
const bob = { authenticated: true, subject: 'bob' };
for (let index = 0; index < 123; index += 1) {
  await commands.create({ principal: alice, input: { agentId: 'hafize-general', task: `daily task ${index}`, runAt: `2026-09-17T${String(index % 24).padStart(2, '0')}:00:00.000Z` } });
}
const bobTask = await commands.create({ principal: bob, input: { agentId: 'hafize-general', task: 'other user task', runAt: '2026-09-18T08:00:00.000Z' } });

const authenticator = { authenticate: ({ headers }) => headers?.authorization === 'Bearer ok' ? { ok: true, principal: alice } : { ok: false } };
const api = createScheduleHttpApi({ authenticator, commands, readJson: async (request) => request.body ? JSON.parse(request.body) : {} });

const unauthorized = await api.handle({ request: { url: '/api/schedules' }, method: 'GET', pathname: '/api/schedules', headers: {} });
assert.equal(unauthorized.status, 401);

let cursor = null;
const seen = new Set();
let total = 0;
let rounds = 0;
do {
  const query = new URLSearchParams({ limit: '17', status: 'scheduled', sort: 'runAt-asc' });
  if (cursor) query.set('cursor', cursor);
  const page = await api.handle({ request: { url: `/api/schedules?${query}` }, method: 'GET', pathname: '/api/schedules', headers: { authorization: 'Bearer ok' } });
  assert.equal(page.status, 200);
  assert.equal(page.body.ok, true);
  assert.ok(page.body.schedules.length <= 17);
  page.body.schedules.forEach((entry) => {
    assert.equal('ownerId' in entry, false);
    assert.equal(seen.has(entry.scheduleId), false);
    seen.add(entry.scheduleId);
  });
  total = page.body.total;
  cursor = page.body.nextCursor;
  rounds += 1;
} while (cursor);
assert.equal(total, 123);
assert.equal(seen.size, 123);
assert.ok(rounds >= 7);

const search = await api.handle({ request: { url: '/api/schedules?q=daily%20task%2012&limit=20' }, method: 'GET', pathname: '/api/schedules', headers: { authorization: 'Bearer ok' } });
assert.equal(search.status, 200);
assert.deepEqual(search.body.schedules.map((entry) => entry.task), ['daily task 12', 'daily task 120', 'daily task 121', 'daily task 122']);

const invalid = await api.handle({ request: { url: '/api/schedules?limit=101' }, method: 'GET', pathname: '/api/schedules', headers: { authorization: 'Bearer ok' } });
assert.equal(invalid.status, 400);

const bulk = await api.handle({ request: { url: '/api/schedules/bulk-cancel', body: JSON.stringify({ scheduleIds: ['schedule_1', 'schedule_2', bobTask.schedule.scheduleId] }) }, method: 'POST', pathname: '/api/schedules/bulk-cancel', headers: { authorization: 'Bearer ok' } });
assert.equal(bulk.status, 200);
assert.equal(bulk.body.cancelled, 2);
assert.equal(store.read(bobTask.schedule.scheduleId).status, 'scheduled');

const malformedId = await api.handle({ request: { url: '/api/schedules/nope/extra' }, method: 'DELETE', pathname: '/api/schedules/nope/extra', headers: { authorization: 'Bearer ok' } });
assert.equal(malformedId.status, 404);

console.log('schedule HTTP pagination tests passed');
