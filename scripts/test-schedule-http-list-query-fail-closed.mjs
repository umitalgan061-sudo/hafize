import assert from 'node:assert/strict';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

let listCalls = 0;
const api = createScheduleHttpApi({
  authenticator: { authenticate: () => ({ authenticated: true, subject: 'alice' }) },
  sessionAuthenticator: null,
  commands: {
    async list() { listCalls += 1; return { ok: true, schedules: [] }; },
    async create() { throw new Error('unused'); },
    async reschedule() { throw new Error('unused'); },
    async cancel() { throw new Error('unused'); }
  },
  readJson: async () => ({}),
  listLimit: 200
});

for (const url of [
  '/api/schedules?limit=201',
  '/api/schedules?limit=10&limit=20',
  '/api/schedules?offset=10001',
  '/api/schedules?unknown=1'
]) {
  const result = await api.handle({ request: { url }, method: 'GET', pathname: '/api/schedules', headers: {} });
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: 'INVALID_SCHEDULE_LIST_QUERY' });
}
assert.equal(listCalls, 0, 'invalid query must not execute commands.list');

const valid = await api.handle({
  request: { url: '/api/schedules?limit=25&offset=50' },
  method: 'GET',
  pathname: '/api/schedules',
  headers: {}
});
assert.equal(valid.status, 200);
assert.equal(listCalls, 1);

console.log('schedule HTTP list query fail-closed: ok');
