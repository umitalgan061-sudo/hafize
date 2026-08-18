import assert from 'node:assert/strict';
import { createScheduleHttpApi, parseListQuery } from '../lib/schedule-http-api.mjs';

function item(index, overrides = {}) {
  return {
    scheduleId: `schedule_${index}`,
    ownerId: 'owner-http-secret',
    agentId: 'minimal-engineer',
    task: `Görev ${index} ${'x'.repeat(500)}`,
    runAt: new Date(Date.UTC(2026, 7, 18, 12 + index)).toISOString(),
    status: index === 1 ? 'running' : 'scheduled',
    attempts: index === 1 ? 1 : 0,
    maxAttempts: 3,
    traceId: `trace-http-secret-${index}`,
    lastError: `private-http-error-${index}`,
    createdAt: '2026-08-18T10:00:00.000Z',
    updatedAt: new Date(Date.UTC(2026, 7, 18, 11 + index)).toISOString(),
    ...overrides
  };
}

const principal = Object.freeze({ subject: 'owner-1' });
const authenticator = Object.freeze({
  authenticate() {
    return Object.freeze({ ok: true, principal });
  }
});
let listCalls = 0;
const schedules = [item(1), item(2), item(3)];
const commands = Object.freeze({
  async list({ principal: seen }) {
    listCalls += 1;
    assert.equal(seen, principal);
    return { ok: true, schedules };
  },
  async create() { return { ok: true }; },
  async reschedule() { return { ok: true }; },
  async cancel() { return { ok: true }; }
});
const api = createScheduleHttpApi({
  authenticator,
  sessionAuthenticator: null,
  commands,
  readJson: async () => ({}),
  listLimit: 2
});

function request(url) {
  return { url, headers: {} };
}

const full = await api.handle({
  request: request('/api/schedules?limit=2'),
  method: 'GET',
  pathname: '/api/schedules',
  headers: {}
});
assert.equal(full.status, 200);
assert.equal(full.body.ok, true);
assert.equal(full.body.view, undefined);
assert.equal(full.body.schedules.length, 2);
assert.equal(full.body.schedules[0].ownerId, 'owner-http-secret');
assert.match(full.body.schedules[0].task, /x{100}/);
assert.equal(full.body.listMeta.total, 3);
assert.equal(full.body.listMeta.nextOffset, 2);
const snapshot = full.body.listMeta.snapshot;
assert.match(snapshot, /^[A-Za-z0-9_-]{43}$/);

const summary = await api.handle({
  request: request('/api/schedules?limit=2&view=summary'),
  method: 'GET',
  pathname: '/api/schedules',
  headers: {}
});
assert.equal(summary.status, 200);
assert.equal(summary.body.ok, true);
assert.equal(summary.body.view, 'summary');
assert.equal(summary.body.schedules.length, 2);
assert.equal(summary.body.listMeta.total, 3);
assert.equal(summary.body.listMeta.nextOffset, 2);
assert.equal(summary.body.listMeta.snapshot, snapshot);
for (const entry of summary.body.schedules) {
  assert.deepEqual(Object.keys(entry), [
    'scheduleId',
    'agentId',
    'task',
    'taskTruncated',
    'runAt',
    'status',
    'attempts',
    'maxAttempts'
  ]);
  assert.equal(entry.taskTruncated, true);
  assert.ok(entry.task.length <= 180);
  assert.equal('ownerId' in entry, false);
  assert.equal('traceId' in entry, false);
  assert.equal('lastError' in entry, false);
}

const next = await api.handle({
  request: request(`/api/schedules?limit=2&offset=2&snapshot=${snapshot}&view=summary`),
  method: 'GET',
  pathname: '/api/schedules',
  headers: {}
});
assert.equal(next.status, 200);
assert.equal(next.body.view, 'summary');
assert.equal(next.body.schedules.length, 1);
assert.equal(next.body.listMeta.offset, 2);
assert.equal(next.body.listMeta.nextOffset, null);
assert.equal(next.body.listMeta.snapshot, snapshot);

const beforeInvalid = listCalls;
for (const url of [
  '/api/schedules?view=full',
  '/api/schedules?view=SUMMARY',
  '/api/schedules?view=summary&view=summary',
  '/api/schedules?view=',
  '/api/schedules?limit=2&offset=2&view=summary',
  `/api/schedules?limit=2&snapshot=${snapshot}&view=summary`,
  '/api/schedules?limit=3&view=summary',
  '/api/schedules?limit=02&view=summary',
  '/api/schedules?unknown=1&view=summary'
]) {
  const result = await api.handle({ request: request(url), method: 'GET', pathname: '/api/schedules', headers: {} });
  assert.equal(result.status, 400, url);
  assert.deepEqual(result.body, { error: 'INVALID_SCHEDULE_LIST_QUERY' }, url);
}
assert.equal(listCalls, beforeInvalid, 'invalid summary query must not execute commands.list');

const parsed = parseListQuery(request('/api/schedules?limit=2&view=summary'), 2);
assert.deepEqual(parsed, { limit: 2, offset: 0, snapshot: null, view: 'summary' });
const parsedLegacy = parseListQuery(request('/api/schedules?limit=2'), 2);
assert.deepEqual(parsedLegacy, { limit: 2, offset: 0, snapshot: null, view: null });

const serializedSummary = JSON.stringify(summary.body);
for (const forbidden of [
  'owner-http-secret',
  'trace-http-secret',
  'private-http-error',
  'ownerId',
  'traceId',
  'lastError'
]) assert.equal(serializedSummary.includes(forbidden), false, `summary leaked ${forbidden}`);

assert.equal(listCalls, 3);
console.log('schedule list summary HTTP tests passed');
