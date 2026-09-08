import assert from 'node:assert/strict';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';

let addCalls = 0;
const store = {
  async add(input) { addCalls += 1; return { scheduleId: 'schedule_1', ...input, status: 'scheduled', attempts: 0, lastError: null, createdAt: 1, updatedAt: 1 }; },
  async read(id) { return id === 'schedule_1' ? { scheduleId: id, ownerId: 'owner-1', status: 'scheduled' } : null; },
  async snapshot() { return { entries: [] }; },
  async cancel() { return { scheduleId: 'schedule_1', ownerId: 'owner-1', status: 'cancelled' }; }
};
const registry = { agents: [{ id: 'hafize-general' }] };
const boundary = createScheduleCommandBoundary({ store, registry, createTraceId: () => 'trace-schedule-credential-001' });
const principal = { authenticated: true, subject: 'owner-1' };

assert.equal((await boundary.create({ principal, input: { agentId: 'hafize-general', task: 'normal scheduled task', runAt: '2026-09-08T12:00:00Z' } })).ok, true);
assert.equal(addCalls, 1);
for (const task of [
  'password: hunter22',
  'Authorization: Bearer abcdefghijklmnop',
  'github_pat_1234567890abcdefghijABCDEFGHIJ',
  'nvapi-1234567890abcdefghijklmnopqrstuv',
  'ya29.A0ARrdaM_exampleGoogleOauthToken123456789',
  '-----BEGIN PRIVATE KEY-----'
]) {
  const result = await boundary.create({ principal, input: { agentId: 'hafize-general', task, runAt: '2026-09-08T12:00:00Z' } });
  assert.deepEqual(result, { ok: false, error: 'SCHEDULE_TASK_CREDENTIAL_NOT_ALLOWED' });
}
assert.equal(addCalls, 1, 'credential-bearing tasks never reach persistence');
assert.deepEqual(await boundary.create({ principal: { authenticated: false, subject: 'owner-1' }, input: { agentId: 'hafize-general', task: 'normal', runAt: '2026-09-08T12:00:00Z' } }), { ok: false, error: 'AUTH_REQUIRED' });
assert.deepEqual(await boundary.create({ principal, input: { agentId: 'missing', task: 'normal', runAt: '2026-09-08T12:00:00Z' } }), { ok: false, error: 'INVALID_AGENT' });
assert.deepEqual(await boundary.create({ principal, input: { agentId: 'hafize-general', task: '   ', runAt: '2026-09-08T12:00:00Z' } }), { ok: false, error: 'INVALID_SCHEDULE_COMMAND' });
assert.deepEqual(await boundary.create({ principal, input: { agentId: 'hafize-general', task: 'normal', runAt: '2026-09-08T12:00:00Z', extra: true } }), { ok: false, error: 'INVALID_SCHEDULE_COMMAND' });
console.log('scheduled task credential boundary tests passed');
