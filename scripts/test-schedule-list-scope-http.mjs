import assert from 'node:assert/strict';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

function schedule(index, status) {
  return {
    scheduleId: `schedule_${index}`,
    ownerId: 'owner-secret',
    agentId: 'minimal-engineer',
    task: `Task ${index}`,
    runAt: new Date(Date.UTC(2026, 7, 18, 10 + index)).toISOString(),
    status,
    attempts: status === 'scheduled' ? 0 : 1,
    maxAttempts: 3,
    traceId: `trace-secret-${index}`,
    lastError: status === 'failed' ? 'private-provider-error' : null,
    createdAt: '2026-08-18T10:00:00.000Z',
    updatedAt: new Date(Date.UTC(2026, 7, 18, 10 + index)).toISOString()
  };
}

const rows = [
  schedule(1, 'scheduled'),
  schedule(2, 'failed'),
  schedule(3, 'completed'),
  schedule(4, 'running'),
  schedule(5, 'failed'),
  schedule(6, 'cancelled')
];
const principal = Object.freeze({ subject: 'owner-1' });
let listCalls = 0;
const api = createScheduleHttpApi({
  authenticator: { authenticate: () => ({ ok: true, principal }) },
  sessionAuthenticator: null,
  commands: {
    async list({ principal: seen }) {
      listCalls += 1;
      assert.equal(seen, principal);
      return { ok: true, schedules: rows };
    },
    async create() { return { ok: true }; },
    async reschedule() { return { ok: true }; },
    async cancel() { return { ok: true }; }
  },
  readJson: async () => ({}),
  listLimit: 2
});

const get = (url) => api.handle({ request: { url }, method: 'GET', pathname: '/api/schedules', headers: {} });

const failedFirst = await get('/api/schedules?scope=failed&view=summary&limit=1');
assert.equal(failedFirst.status, 200);
assert.equal(failedFirst.body.ok, true);
assert.equal(failedFirst.body.schedules.length, 1);
assert.equal(failedFirst.body.schedules[0].status, 'failed');
assert.equal(failedFirst.body.listMeta.total, 2);
assert.equal(failedFirst.body.listMeta.nextOffset, 1);
assert.match(failedFirst.body.listMeta.snapshot, /^[A-Za-z0-9_-]{43}$/);
assert.equal(JSON.stringify(failedFirst.body).includes('private-provider-error'), false);
assert.equal(JSON.stringify(failedFirst.body).includes('owner-secret'), false);
assert.equal(JSON.stringify(failedFirst.body).includes('trace-secret'), false);

const failedSecond = await get(`/api/schedules?scope=failed&view=summary&limit=1&offset=1&snapshot=${failedFirst.body.listMeta.snapshot}`);
assert.equal(failedSecond.status, 200);
assert.equal(failedSecond.body.schedules.length, 1);
assert.equal(failedSecond.body.schedules[0].status, 'failed');
assert.notEqual(failedSecond.body.schedules[0].scheduleId, failedFirst.body.schedules[0].scheduleId);
assert.equal(failedSecond.body.listMeta.nextOffset, null);
assert.equal(failedSecond.body.listMeta.total, 2);

const active = await get('/api/schedules?scope=active&view=summary&limit=2');
assert.equal(active.status, 200);
assert.deepEqual(new Set(active.body.schedules.map((entry) => entry.status)), new Set(['scheduled', 'running']));
assert.equal(active.body.listMeta, undefined, 'exactly two active rows should fit without pagination metadata');

const history = await get('/api/schedules?scope=history&view=summary&limit=2');
assert.equal(history.status, 200);
assert.equal(history.body.schedules.length, 2);
assert.equal(history.body.listMeta.total, 4);
assert.ok(history.body.schedules.every((entry) => ['completed', 'failed', 'cancelled'].includes(entry.status)));

const all = await get('/api/schedules?scope=all&view=summary&limit=2');
assert.equal(all.status, 200);
assert.equal(all.body.listMeta.total, 6);

const beforeInvalid = listCalls;
for (const url of [
  '/api/schedules?scope=',
  '/api/schedules?scope=FAILED',
  '/api/schedules?scope=failed,completed',
  '/api/schedules?scope=scheduled',
  '/api/schedules?scope=all&scope=all',
  '/api/schedules?status=failed'
]) {
  const response = await get(url);
  assert.equal(response.status, 400, url);
  assert.deepEqual(response.body, { error: 'INVALID_SCHEDULE_LIST_QUERY' }, url);
}
assert.equal(listCalls, beforeInvalid, 'invalid scope must fail before commands.list');

assert.equal(listCalls, 5);
console.log('schedule list scope HTTP tests passed');
