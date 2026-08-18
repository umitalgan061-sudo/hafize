import assert from 'node:assert/strict';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

function row(index, status, updatedAt) {
  return {
    scheduleId: `schedule_${index}`,
    ownerId: 'owner-1',
    agentId: 'minimal-engineer',
    task: `Task ${index}`,
    runAt: `2026-08-18T${String(10 + index).padStart(2, '0')}:00:00.000Z`,
    status,
    attempts: status === 'scheduled' ? 0 : 1,
    maxAttempts: 3,
    createdAt: '2026-08-18T10:00:00.000Z',
    updatedAt
  };
}

let rows = [
  row(1, 'failed', '2026-08-18T10:01:00.000Z'),
  row(2, 'failed', '2026-08-18T10:02:00.000Z'),
  row(3, 'completed', '2026-08-18T10:03:00.000Z'),
  row(4, 'scheduled', '2026-08-18T10:04:00.000Z')
];
const api = createScheduleHttpApi({
  authenticator: { authenticate: () => ({ ok: true, principal: { subject: 'owner-1' } }) },
  sessionAuthenticator: null,
  commands: {
    async list() { return { ok: true, schedules: rows }; },
    async create() { return { ok: true }; },
    async reschedule() { return { ok: true }; },
    async cancel() { return { ok: true }; }
  },
  readJson: async () => ({}),
  listLimit: 1
});
const get = (url) => api.handle({ request: { url }, method: 'GET', pathname: '/api/schedules', headers: {} });

const first = await get('/api/schedules?scope=failed&limit=1');
assert.equal(first.status, 200);
assert.equal(first.body.listMeta.total, 2);
const failedSnapshot = first.body.listMeta.snapshot;
assert.match(failedSnapshot, /^[A-Za-z0-9_-]{43}$/);

rows = rows.map((entry) => entry.scheduleId === 'schedule_4'
  ? { ...entry, status: 'running', updatedAt: '2026-08-18T11:00:00.000Z' }
  : entry);
const unaffected = await get(`/api/schedules?scope=failed&limit=1&offset=1&snapshot=${failedSnapshot}`);
assert.equal(unaffected.status, 200, 'mutation outside failed scope must not invalidate failed pagination');
assert.equal(unaffected.body.schedules.length, 1);

rows = rows.map((entry) => entry.scheduleId === 'schedule_2'
  ? { ...entry, updatedAt: '2026-08-18T11:01:00.000Z' }
  : entry);
const stale = await get(`/api/schedules?scope=failed&limit=1&offset=1&snapshot=${failedSnapshot}`);
assert.equal(stale.status, 409);
assert.deepEqual(stale.body, { error: 'SCHEDULE_LIST_SNAPSHOT_CHANGED' });

const restarted = await get('/api/schedules?scope=failed&limit=1');
assert.equal(restarted.status, 200);
assert.notEqual(restarted.body.listMeta.snapshot, failedSnapshot);
const replacementSnapshot = restarted.body.listMeta.snapshot;

rows = rows.map((entry) => entry.scheduleId === 'schedule_3'
  ? { ...entry, status: 'failed', updatedAt: '2026-08-18T11:02:00.000Z' }
  : entry);
const membershipChanged = await get(`/api/schedules?scope=failed&limit=1&offset=1&snapshot=${replacementSnapshot}`);
assert.equal(membershipChanged.status, 409, 'entering the selected scope must invalidate its snapshot');

const activeFirst = await get('/api/schedules?scope=active&limit=1');
assert.equal(activeFirst.status, 200);
const activeSnapshot = activeFirst.body.listMeta?.snapshot;
assert.match(activeSnapshot, /^[A-Za-z0-9_-]{43}$/);
rows = rows.map((entry) => entry.scheduleId === 'schedule_1'
  ? { ...entry, updatedAt: '2026-08-18T11:03:00.000Z' }
  : entry);
const activeNext = await get(`/api/schedules?scope=active&limit=1&offset=1&snapshot=${activeSnapshot}`);
assert.notEqual(activeNext.status, 409, 'failed-row mutation must not invalidate active snapshot');

console.log('schedule list scope snapshot tests passed');
