import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const reschedule = require('../public/schedule-reschedule.js');

assert.equal(reschedule.PATH, '/api/schedules');
assert.equal(reschedule.MAX_SCHEDULE_ID_CHARS, 120);
assert.equal(reschedule.AUTO_MOUNT_TIMEOUT_MS, 10_000);
assert.equal(reschedule.RESCHEDULED_EVENT, 'hafize:schedule-rescheduled');

assert.equal(reschedule.normalizeScheduleId('task-123'), 'task-123');
assert.equal(reschedule.normalizeScheduleId(' task:abc_2 '), 'task:abc_2');
assert.equal(reschedule.normalizeScheduleId(''), null);
assert.equal(reschedule.normalizeScheduleId('../task'), null);
assert.equal(reschedule.normalizeScheduleId('task/child'), null);
assert.equal(reschedule.normalizeScheduleId('x'.repeat(121)), null);
assert.equal(reschedule.schedulePath('task-123'), '/api/schedules/task-123');
assert.equal(reschedule.schedulePath('../task'), null);

const future = '2032-06-01T09:45';
assert.equal(
  reschedule.normalizeLocalDateTime(future, Date.parse('2030-01-01T00:00:00Z')),
  new Date(future).toISOString()
);
assert.equal(
  reschedule.normalizeLocalDateTime('2020-01-01T10:00', Date.parse('2021-01-01T00:00:00Z')),
  null
);
assert.equal(reschedule.normalizeLocalDateTime('not-a-date', 0), null);
assert.equal(reschedule.normalizeLocalDateTime('', 0), null);

const iso = '2032-06-01T09:45:00.000Z';
const local = reschedule.localInputValue(iso);
assert.match(local, /^2032-06-01T\d{2}:45$/);
assert.equal(reschedule.localInputValue('invalid'), '');

const calls = [];
const client = reschedule.createClient({
  fetchImpl: async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      async json() { return { ok: true, schedule: { scheduleId: 'task-123' } }; }
    };
  }
});
const runAt = '2032-06-01T09:45:00.000Z';
const result = await client.reschedule('task-123', runAt);
assert.equal(result.ok, true);
assert.equal(result.status, 200);
assert.equal(calls.length, 1);
assert.equal(calls[0].url, '/api/schedules/task-123');
assert.equal(calls[0].init.method, 'PATCH');
assert.equal(calls[0].init.credentials, 'same-origin');
assert.equal(calls[0].init.cache, 'no-store');
assert.deepEqual(calls[0].init.headers, {
  Accept: 'application/json',
  'Content-Type': 'application/json'
});
assert.deepEqual(JSON.parse(calls[0].init.body), { runAt });

const rejected = await client.reschedule('../bad', runAt);
assert.equal(rejected.ok, false);
assert.equal(rejected.status, 0);
assert.equal(rejected.payload.error, 'INVALID_RESCHEDULE_REQUEST');
assert.equal(calls.length, 1, 'invalid id must not reach fetch');

const malformedClient = reschedule.createClient({
  fetchImpl: async () => ({ ok: false, status: 409, async json() { throw new Error('bad json'); } })
});
const malformed = await malformedClient.reschedule('task-123', runAt);
assert.equal(malformed.ok, false);
assert.equal(malformed.status, 409);
assert.deepEqual(malformed.payload, {});

assert.throws(() => reschedule.createClient({ fetchImpl: null }), /INVALID_SCHEDULE_RESCHEDULE_FETCH/);

console.log('schedule reschedule helper tests passed');
