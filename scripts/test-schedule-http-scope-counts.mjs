import assert from 'node:assert/strict';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

function authenticator(subject = 'owner_alice') {
  return {
    authenticate() {
      return { ok: true, principal: { subject } };
    }
  };
}

function commands() {
  return {
    async list({ principal }) {
      assert.equal(principal.subject, 'owner_alice');
      return {
        ok: true,
        schedules: [
          { scheduleId: 'schedule_1', ownerId: 'owner_alice', agentId: 'minimal-engineer', task: 'one', runAt: '2026-08-20T10:00:00.000Z', status: 'scheduled', attempts: 0, maxAttempts: 2, traceId: 'trace_1' },
          { scheduleId: 'schedule_2', ownerId: 'owner_alice', agentId: 'minimal-engineer', task: 'two', runAt: '2026-08-19T10:00:00.000Z', status: 'running', attempts: 1, maxAttempts: 2, traceId: 'trace_2' },
          { scheduleId: 'schedule_3', ownerId: 'owner_alice', agentId: 'minimal-engineer', task: 'three', runAt: '2026-08-18T10:00:00.000Z', status: 'failed', attempts: 2, maxAttempts: 2, traceId: 'trace_3', lastError: 'private' },
          { scheduleId: 'schedule_4', ownerId: 'owner_alice', agentId: 'minimal-engineer', task: 'four', runAt: '2026-08-17T10:00:00.000Z', status: 'completed', attempts: 1, maxAttempts: 2, traceId: 'trace_4' }
        ]
      };
    },
    async create() { throw new Error('unexpected create'); },
    async reschedule() { throw new Error('unexpected reschedule'); },
    async cancel() { throw new Error('unexpected cancel'); }
  };
}

const api = createScheduleHttpApi({
  authenticator: authenticator(),
  sessionAuthenticator: null,
  commands: commands(),
  readJson: async () => ({}),
  listLimit: 2
});

const response = await api.handle({
  request: { url: '/api/schedules?limit=2&view=summary&scope=failed', headers: {} },
  method: 'GET',
  pathname: '/api/schedules',
  headers: {}
});
assert.equal(response.status, 200);
assert.equal(response.body.ok, true);
assert.deepEqual(response.body.listMeta.scopeCounts, { all: 4, active: 2, history: 2, failed: 1 });
assert.equal(response.body.schedules.length, 1);
assert.equal(response.body.schedules[0].status, 'failed');
assert.equal('ownerId' in response.body.schedules[0], false);
assert.equal('traceId' in response.body.schedules[0], false);
assert.equal('lastError' in response.body.schedules[0], false);
assert.deepEqual(Object.keys(response.body.listMeta.scopeCounts).sort(), ['active', 'all', 'failed', 'history']);

const all = await api.handle({
  request: { url: '/api/schedules?limit=2&view=summary&scope=all', headers: {} },
  method: 'GET',
  pathname: '/api/schedules',
  headers: {}
});
assert.equal(all.status, 200);
assert.equal(all.body.listMeta.total, 4);
assert.deepEqual(all.body.listMeta.scopeCounts, response.body.listMeta.scopeCounts);
assert.equal(typeof all.body.listMeta.snapshot, 'string');
assert.equal(all.body.listMeta.snapshot.length, 43);

const active = await api.handle({
  request: { url: '/api/schedules?limit=2&view=summary&scope=active', headers: {} },
  method: 'GET',
  pathname: '/api/schedules',
  headers: {}
});
assert.equal(active.status, 200);
assert.deepEqual(active.body.listMeta.scopeCounts, { all: 4, active: 2, history: 2, failed: 1 });
assert.equal(active.body.schedules.every((item) => ['scheduled', 'running'].includes(item.status)), true);

process.stdout.write('schedule HTTP scope counts tests passed\n');
