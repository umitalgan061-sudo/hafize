import assert from 'node:assert/strict';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

const principal = Object.freeze({ authenticated: true, subject: 'owner-1' });
const seen = [];
const commands = {
  async create() { throw new Error('not used'); },
  async list() { throw new Error('not used'); },
  async cancel() { throw new Error('not used'); },
  async reschedule(input) {
    seen.push(input);
    if (input.scheduleId === 'schedule_conflict') return { ok: false, error: 'SCHEDULE_NOT_RESCHEDULABLE' };
    return { ok: true, schedule: { scheduleId: input.scheduleId, retryDelayMs: input.input.retryDelayMs } };
  }
};
const authenticator = { authenticate() { return { ok: true, principal }; } };
const sessionAuthenticator = { authenticate() { return { ok: false, error: 'AUTH_REQUIRED' }; } };
const readJson = async (request) => request.body;
const api = createScheduleHttpApi({ authenticator, sessionAuthenticator, commands, readJson });

const ok = await api.handle({
  request: { body: { retryDelayMs: 900_000 } },
  method: 'PATCH',
  pathname: '/api/schedules/schedule_7',
  headers: {}
});
assert.equal(ok.matched, true);
assert.equal(ok.status, 200);
assert.equal(ok.body.ok, true);
assert.deepEqual(seen[0], {
  principal,
  scheduleId: 'schedule_7',
  input: { retryDelayMs: 900_000 }
});

const encoded = await api.handle({
  request: { body: { retryDelayMs: 300_000 } },
  method: 'PATCH',
  pathname: '/api/schedules/schedule_%38',
  headers: {}
});
assert.equal(encoded.status, 200);
assert.equal(seen[1].scheduleId, 'schedule_8');

const conflict = await api.handle({
  request: { body: { retryDelayMs: 60_000 } },
  method: 'PATCH',
  pathname: '/api/schedules/schedule_conflict',
  headers: {}
});
assert.equal(conflict.status, 409);
assert.deepEqual(conflict.body, { error: 'SCHEDULE_NOT_RESCHEDULABLE' });

const nested = await api.handle({
  request: { body: { retryDelayMs: 60_000 } },
  method: 'PATCH',
  pathname: '/api/schedules/a/b',
  headers: {}
});
assert.equal(nested.status, 404);
assert.equal(seen.length, 3, 'invalid nested id must not reach command boundary');

const method = await api.handle({
  request: { body: { retryDelayMs: 60_000 } },
  method: 'PUT',
  pathname: '/api/schedules/schedule_9',
  headers: {}
});
assert.equal(method.status, 405);
assert.deepEqual(method.headers, { Allow: 'PATCH, DELETE' });
assert.equal(seen.length, 3, 'unsupported method must not mutate schedule state');

console.log('schedule retry policy HTTP tests passed');
