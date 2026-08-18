import assert from 'node:assert/strict';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

const principal = { authenticated: true, subject: 'alice' };
const authenticator = { authenticate: () => principal };
const schedules = Array.from({ length: 8 }, (_, index) => ({
  scheduleId: `schedule_${index + 1}`,
  traceId: `trace_${index + 1}`,
  agentId: 'minimal-engineer',
  task: `task ${index + 1}`,
  runAt: `2026-08-${String(19 + index).padStart(2, '0')}T10:00:00Z`,
  status: index === 0 ? 'scheduled' : index === 1 ? 'running' : 'completed',
  attempts: index === 1 ? 1 : 0,
  maxAttempts: 1,
  retryDelayMs: 60000,
  lastError: null,
  createdAt: `2026-08-${String(10 + index).padStart(2, '0')}T10:00:00Z`,
  updatedAt: null
}));

let listCalls = 0;
const commands = {
  async list() { listCalls += 1; return { ok: true, schedules }; },
  async create() { return { ok: false, error: 'unused' }; },
  async reschedule() { return { ok: false, error: 'unused' }; },
  async cancel() { return { ok: false, error: 'unused' }; }
};
const api = createScheduleHttpApi({
  authenticator,
  sessionAuthenticator: null,
  commands,
  readJson: async () => ({}),
  listLimit: 4
});

const response = await api.handle({ method: 'GET', pathname: '/api/schedules', headers: {} });
assert.equal(response.status, 200);
assert.equal(response.body.schedules.length, 4);
assert.equal(response.body.listMeta.returned, 4);
assert.equal(response.body.listMeta.total, 8);
assert.equal(response.body.listMeta.truncated, true);
assert.equal(listCalls, 1);
assert(response.body.schedules.some((item) => item.status === 'scheduled'));
assert(response.body.schedules.some((item) => item.status === 'running'));

const unauthorized = createScheduleHttpApi({
  authenticator: { authenticate: () => null },
  sessionAuthenticator: null,
  commands,
  readJson: async () => ({}),
  listLimit: 4
});
const denied = await unauthorized.handle({ method: 'GET', pathname: '/api/schedules', headers: {} });
assert.equal(denied.status, 401);
assert.equal(listCalls, 1, 'auth must fail before list execution');

console.log('schedule HTTP list boundary: ok');
