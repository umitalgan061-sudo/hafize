import assert from 'node:assert/strict';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

const principal = Object.freeze({ subject: 'page-walk-user' });
const authenticator = { authenticate: () => ({ ok: true, principal }) };
const readJson = async () => ({});

function makeSchedules(count) {
  return Array.from({ length: count }, (_, index) => ({
    scheduleId: `schedule_${index + 1}`,
    agentId: 'minimal-engineer',
    task: `Görev ${index + 1}`,
    status: index < 8 ? 'scheduled' : 'completed',
    attempts: 0,
    maxAttempts: 1,
    createdAt: new Date(Date.UTC(2026, 7, 18, 8, 0, index)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 7, 18, 8, 0, index)).toISOString(),
    runAt: new Date(Date.UTC(2026, 7, 19, 8, index % 60, 0)).toISOString()
  }));
}

let schedules = makeSchedules(240);
const commands = {
  async list({ principal: seen }) {
    assert.equal(seen, principal);
    return { ok: true, schedules: schedules.map((item) => ({ ...item })) };
  },
  async create() { return { ok: true }; },
  async reschedule() { return { ok: true }; },
  async cancel() { return { ok: true }; }
};
const api = createScheduleHttpApi({ authenticator, sessionAuthenticator: null, commands, readJson, listLimit: 100 });

async function page(url) {
  return api.handle({ request: { url }, method: 'GET', pathname: '/api/schedules', headers: {} });
}

const first = await page('/api/schedules?limit=100');
assert.equal(first.status, 200);
assert.equal(first.body.schedules.length, 100);
assert.equal(first.body.listMeta.total, 240);
assert.equal(first.body.listMeta.nextOffset, 100);
const snapshot = first.body.listMeta.snapshot;

const second = await page(`/api/schedules?limit=100&offset=100&snapshot=${snapshot}`);
assert.equal(second.status, 200);
assert.equal(second.body.schedules.length, 100);
assert.equal(second.body.listMeta.nextOffset, 200);

const third = await page(`/api/schedules?limit=100&offset=200&snapshot=${snapshot}`);
assert.equal(third.status, 200);
assert.equal(third.body.schedules.length, 40);
assert.equal(third.body.listMeta.nextOffset, null);

const walked = [...first.body.schedules, ...second.body.schedules, ...third.body.schedules].map((item) => item.scheduleId);
assert.equal(walked.length, 240);
assert.equal(new Set(walked).size, 240, 'unchanged snapshot page walk must neither duplicate nor omit records');

const oldSecondUrl = `/api/schedules?limit=100&offset=100&snapshot=${snapshot}`;
schedules = schedules.map((item) => ({ ...item }));
schedules[120].status = 'running';
schedules[120].updatedAt = '2026-08-18T12:00:00.000Z';
const stale = await page(oldSecondUrl);
assert.equal(stale.status, 409);
assert.deepEqual(stale.body, { error: 'SCHEDULE_LIST_SNAPSHOT_CHANGED' });

const restartedFirst = await page('/api/schedules?limit=100');
assert.equal(restartedFirst.status, 200);
assert.notEqual(restartedFirst.body.listMeta.snapshot, snapshot);
const freshSnapshot = restartedFirst.body.listMeta.snapshot;
const restartedSecond = await page(`/api/schedules?limit=100&offset=100&snapshot=${freshSnapshot}`);
assert.equal(restartedSecond.status, 200);
const restartedIds = [...restartedFirst.body.schedules, ...restartedSecond.body.schedules].map((item) => item.scheduleId);
assert.equal(new Set(restartedIds).size, restartedIds.length, 'restart after 409 must produce a clean page sequence');

console.log('schedule list snapshot page-walk tests passed');
