import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/schedule-create.js');

assert.equal(api.PATH, '/api/schedules');
assert.equal(api.MAX_TASK_CHARS, 4000);
assert.equal(api.MAX_AGENT_ID_CHARS, 120);
assert.equal(api.MAX_ATTEMPTS, 5);
assert.equal(api.CREATED_EVENT, 'hafize:schedule-created');

const agents = ['minimal-engineer', 'movie-coordinator'];
assert.equal(api.normalizeAgentId(' minimal-engineer ', agents), 'minimal-engineer');
assert.equal(api.normalizeAgentId('unknown', agents), null);
assert.equal(api.normalizeAgentId('x'.repeat(121), ['x'.repeat(121)]), null);
assert.equal(api.normalizeAgentId('', agents), null);

assert.equal(api.normalizeTask('  görev  '), 'görev');
assert.equal(api.normalizeTask('x'.repeat(4000)), 'x'.repeat(4000));
assert.equal(api.normalizeTask('x'.repeat(4001)), null);
assert.equal(api.normalizeTask('   '), null);

const iso = api.localDateTimeToIso('2030-06-04T13:45');
assert.equal(typeof iso, 'string');
assert.equal(Number.isFinite(Date.parse(iso)), true);
assert.equal(api.localDateTimeToIso('2030-06-04'), null);
assert.equal(api.localDateTimeToIso('bad'), null);

for (let value = 1; value <= 5; value += 1) assert.equal(api.normalizeAttempts(String(value)), value);
assert.equal(api.normalizeAttempts('0'), null);
assert.equal(api.normalizeAttempts('6'), null);
assert.equal(api.normalizeAttempts('1.5'), null);

const input = api.buildCreateInput({
  agentId: 'minimal-engineer',
  task: 'Saatlik rapor hazırla',
  runAtLocal: '2030-06-04T13:45',
  maxAttempts: '3'
}, agents);
assert.equal(input.agentId, 'minimal-engineer');
assert.equal(input.task, 'Saatlik rapor hazırla');
assert.equal(input.maxAttempts, 3);
assert.deepEqual(Object.keys(input).sort(), ['agentId', 'maxAttempts', 'runAt', 'task']);
assert.equal(Object.isFrozen(input), true);

assert.equal(api.buildCreateInput({ agentId: 'unknown', task: 'x', runAtLocal: '2030-06-04T13:45', maxAttempts: 1 }, agents), null);
assert.equal(api.buildCreateInput({ agentId: 'minimal-engineer', task: '', runAtLocal: '2030-06-04T13:45', maxAttempts: 1 }, agents), null);

const before = new Date('2030-06-04T10:12:34.000Z');
const defaultLocal = api.nextDefaultLocalDate(before);
assert.match(defaultLocal, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

let request = null;
const client = api.createClient({
  fetchImpl: async (url, options) => {
    request = { url, options };
    return { ok: true, status: 201, async json() { return { ok: true, schedule: { scheduleId: 'schedule_1' } }; } };
  }
});
const result = await client.create(input);
assert.equal(result.ok, true);
assert.equal(result.status, 201);
assert.equal(request.url, '/api/schedules');
assert.equal(request.options.method, 'POST');
assert.equal(request.options.credentials, 'same-origin');
assert.equal(request.options.cache, 'no-store');
assert.deepEqual(JSON.parse(request.options.body), input);
assert.equal(request.options.headers.Authorization, undefined);
assert.equal(request.options.headers.Accept, 'application/json');
assert.equal(request.options.headers['Content-Type'], 'application/json');

console.log('schedule create helper tests passed');
