import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cancel = require('../public/schedule-cancel.js');

assert.equal(cancel.PATH, '/api/schedules');
assert.equal(cancel.MAX_SCHEDULE_ID_CHARS, 120);
assert.equal(cancel.CANCELLED_EVENT, 'hafize:schedule-cancelled');

for (const id of ['abc', 'task-123', 'a.b_c:d']) assert.equal(cancel.normalizeScheduleId(id), id);
for (const id of ['', ' ', 'a/b', 'a?b', 'a#b', 'a'.repeat(121), null, 42]) {
  assert.equal(cancel.normalizeScheduleId(id), null);
}
assert.equal(cancel.schedulePath('task-123'), '/api/schedules/task-123');
assert.equal(cancel.schedulePath('a:b'), '/api/schedules/a%3Ab');
assert.equal(cancel.schedulePath('a/b'), null);

const calls = [];
const client = cancel.createClient({
  fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, async json() { return { ok: true, schedule: { scheduleId: 'task-123' } }; } };
  }
});
const result = await client.cancel('task-123');
assert.equal(result.ok, true);
assert.equal(result.status, 200);
assert.equal(result.payload.ok, true);
assert.equal(calls.length, 1);
assert.equal(calls[0].url, '/api/schedules/task-123');
assert.deepEqual(calls[0].options, {
  method: 'DELETE',
  headers: { Accept: 'application/json' },
  credentials: 'same-origin',
  cache: 'no-store'
});
assert.equal(Object.hasOwn(calls[0].options, 'body'), false, 'DELETE must not carry a body');
assert.equal(Object.hasOwn(calls[0].options.headers, 'Authorization'), false, 'browser must not construct bearer auth');

const invalidCalls = [];
const invalidClient = cancel.createClient({ fetchImpl: async (...args) => { invalidCalls.push(args); throw new Error('must not run'); } });
const invalid = await invalidClient.cancel('../secret');
assert.equal(invalid.ok, false);
assert.equal(invalid.status, 0);
assert.equal(invalid.payload.error, 'INVALID_SCHEDULE_ID');
assert.equal(invalidCalls.length, 0, 'invalid ids must fail before network');

const malformedClient = cancel.createClient({
  fetchImpl: async () => ({ ok: false, status: 409, async json() { throw new Error('bad json'); } })
});
const malformed = await malformedClient.cancel('task-123');
assert.equal(malformed.ok, false);
assert.equal(malformed.status, 409);
assert.deepEqual({ ...malformed.payload }, {});

assert.throws(() => cancel.createClient({ fetchImpl: null }), /INVALID_SCHEDULE_CANCEL_FETCH/);
console.log('schedule cancel helper tests passed');
