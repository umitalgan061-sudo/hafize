import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/schedule-create.js');

const input = Object.freeze({
  agentId: 'minimal-engineer',
  task: 'Güvenli görev',
  runAt: '2030-06-04T13:45:00.000Z',
  maxAttempts: 1
});

async function runResponse({ ok, status, json }) {
  let seen = null;
  const client = api.createClient({
    fetchImpl: async (url, options) => {
      seen = { url, options };
      return { ok, status, json };
    }
  });
  const result = await client.create(input);
  return { result, seen };
}

for (const sample of [
  { ok: false, status: 401, body: { error: 'AUTH_REQUIRED' } },
  { ok: false, status: 400, body: { error: 'INVALID_SCHEDULE_COMMAND' } },
  { ok: false, status: 503, body: { error: 'SCHEDULE_CAPACITY_REACHED' } },
  { ok: true, status: 201, body: { ok: true, schedule: { scheduleId: 'schedule_1' } } }
]) {
  const { result, seen } = await runResponse({
    ok: sample.ok,
    status: sample.status,
    json: async () => sample.body
  });
  assert.equal(result.ok, sample.ok);
  assert.equal(result.status, sample.status);
  assert.deepEqual(result.payload, sample.body);
  assert.equal(seen.url, '/api/schedules');
  assert.equal(seen.options.method, 'POST');
  assert.equal(seen.options.credentials, 'same-origin');
  assert.equal(seen.options.cache, 'no-store');
  assert.deepEqual(JSON.parse(seen.options.body), input);
}

const malformed = await runResponse({
  ok: false,
  status: 502,
  json: async () => { throw new Error('upstream body secret should not escape parser'); }
});
assert.deepEqual(malformed.result.payload, {});
assert.equal(malformed.result.status, 502);

const primitive = await runResponse({
  ok: false,
  status: 500,
  json: async () => 'not-an-object'
});
assert.deepEqual(primitive.result.payload, {});

const array = await runResponse({
  ok: false,
  status: 500,
  json: async () => [{ error: 'not accepted as payload' }]
});
assert.deepEqual(array.result.payload, {});

let thrown = null;
const networkClient = api.createClient({
  fetchImpl: async () => { throw new Error('network diagnostic with credential-like detail'); }
});
try {
  await networkClient.create(input);
} catch (error) {
  thrown = error;
}
assert.ok(thrown instanceof Error, 'network errors remain catchable by UI sanitize layer');

const original = JSON.stringify(input);
try { await networkClient.create(input); } catch {}
assert.equal(JSON.stringify(input), original, 'client must not mutate submitted task input');

for (const invalid of [null, undefined, {}, [], 'fetch']) {
  if (typeof invalid === 'function') continue;
  assert.throws(() => api.createClient({ fetchImpl: invalid }), /INVALID_SCHEDULE_CREATE_FETCH/);
}

console.log('schedule create client edge tests passed');
