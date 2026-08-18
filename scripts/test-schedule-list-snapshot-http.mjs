import assert from 'node:assert/strict';
import { createScheduleHttpApi, parseListQuery } from '../lib/schedule-http-api.mjs';

const principal = Object.freeze({ subject: 'user_1' });
const authenticator = { authenticate: () => ({ ok: true, principal }) };
const sessionAuthenticator = null;
const readJson = async () => ({});

function entry(id, status = 'completed', updatedAt = `2026-08-18T08:${String(id).padStart(2, '0')}:00.000Z`) {
  return {
    scheduleId: `schedule_${id}`,
    status,
    updatedAt,
    createdAt: '2026-08-18T08:00:00.000Z',
    runAt: '2026-08-18T13:00:00.000Z'
  };
}

let listCalls = 0;
let schedules = [entry(1), entry(2), entry(3), entry(4, 'scheduled'), entry(5, 'running')];
const commands = {
  async list({ principal: seen }) {
    listCalls += 1;
    assert.equal(seen, principal);
    return { ok: true, schedules: schedules.map((value) => ({ ...value })) };
  },
  async create() { return { ok: true }; },
  async reschedule() { return { ok: true }; },
  async cancel() { return { ok: true }; }
};

const api = createScheduleHttpApi({ authenticator, sessionAuthenticator, commands, readJson, listLimit: 2 });

const first = await api.handle({
  request: { url: '/api/schedules?limit=2' },
  method: 'GET',
  pathname: '/api/schedules',
  headers: {}
});
assert.equal(first.status, 200);
assert.equal(first.body.schedules.length, 2);
assert.equal(first.body.listMeta.nextOffset, 2);
assert.match(first.body.listMeta.snapshot, /^[A-Za-z0-9_-]{43}$/);
assert.equal(listCalls, 1);

const secondUrl = `/api/schedules?limit=2&offset=2&snapshot=${encodeURIComponent(first.body.listMeta.snapshot)}`;
const second = await api.handle({ request: { url: secondUrl }, method: 'GET', pathname: '/api/schedules', headers: {} });
assert.equal(second.status, 200);
assert.equal(second.body.listMeta.offset, 2);
assert.equal(second.body.listMeta.snapshot, first.body.listMeta.snapshot);
assert.equal(listCalls, 2);

const missingSnapshot = await api.handle({
  request: { url: '/api/schedules?limit=2&offset=2' },
  method: 'GET', pathname: '/api/schedules', headers: {}
});
assert.deepEqual(missingSnapshot, {
  matched: true,
  status: 400,
  body: { error: 'INVALID_SCHEDULE_LIST_QUERY' },
  headers: {}
});
assert.equal(listCalls, 2, 'invalid pagination must fail before commands.list');

const firstPageWithSnapshot = await api.handle({
  request: { url: `/api/schedules?limit=2&snapshot=${first.body.listMeta.snapshot}` },
  method: 'GET', pathname: '/api/schedules', headers: {}
});
assert.equal(firstPageWithSnapshot.status, 400);
assert.equal(listCalls, 2);

schedules = schedules.concat(entry(6, 'scheduled', '2026-08-18T09:00:00.000Z'));
const stale = await api.handle({ request: { url: secondUrl }, method: 'GET', pathname: '/api/schedules', headers: {} });
assert.deepEqual(stale, {
  matched: true,
  status: 409,
  body: { error: 'SCHEDULE_LIST_SNAPSHOT_CHANGED' },
  headers: {}
});
assert.equal(listCalls, 3);

for (const url of [
  '/api/schedules?limit=2&offset=2&snapshot=',
  `/api/schedules?limit=2&offset=2&snapshot=${'x'.repeat(42)}`,
  `/api/schedules?limit=2&offset=2&snapshot=${'x'.repeat(44)}`,
  `/api/schedules?limit=2&offset=2&snapshot=${'x'.repeat(43)}&snapshot=${'y'.repeat(43)}`,
  `/api/schedules?limit=2&offset=2&snapshot=${'x'.repeat(43)}&unknown=1`
]) {
  const before = listCalls;
  const result = await api.handle({ request: { url }, method: 'GET', pathname: '/api/schedules', headers: {} });
  assert.equal(result.status, 400, url);
  assert.equal(listCalls, before, `invalid query reached commands.list: ${url}`);
}

assert.deepEqual(parseListQuery({ url: '/api/schedules?limit=2' }, 2), { limit: 2, offset: 0, snapshot: null });
assert.equal(parseListQuery({ url: '/api/schedules?limit=2&offset=2' }, 2), null);
assert.deepEqual(
  parseListQuery({ url: `/api/schedules?limit=2&offset=2&snapshot=${'A'.repeat(43)}` }, 2),
  { limit: 2, offset: 2, snapshot: 'A'.repeat(43) }
);

console.log('schedule list snapshot HTTP tests passed');
