import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const scheduleList = require('../public/schedule-list.js');

for (const scenario of [
  { ok: false, status: 401, json: async () => ({ error: 'AUTH_REQUIRED' }) },
  { ok: false, status: 503, json: async () => ({ error: 'SCHEDULE_COMMAND_FAILED' }) },
  { ok: true, status: 200, json: async () => { throw new Error('invalid json'); } },
  { ok: true, status: 200, json: async () => ['unexpected-array'] }
]) {
  const client = scheduleList.createClient({ fetchImpl: async () => scenario });
  const result = await client.list();
  assert.equal(result.status, scenario.status);
  if (scenario.status === 200 && scenario.json) {
    assert.equal(typeof result.payload, 'object');
    assert.equal(Array.isArray(result.payload), false);
  }
}

const invalidPayloads = [
  { schedules: [{ scheduleId: 'schedule_1', agentId: 'a', task: 'x', runAt: 'invalid', status: 'scheduled', attempts: 0, maxAttempts: 1 }] },
  { schedules: [{ scheduleId: 'schedule_1', agentId: 'a'.repeat(121), task: 'x', runAt: '2026-08-16T20:00:00Z', status: 'scheduled', attempts: 0, maxAttempts: 1 }] },
  { schedules: [{ scheduleId: 's'.repeat(121), agentId: 'a', task: 'x', runAt: '2026-08-16T20:00:00Z', status: 'scheduled', attempts: 0, maxAttempts: 1 }] }
];
for (const payload of invalidPayloads) assert.deepEqual(scheduleList.normalizeSchedules(payload), []);

console.log('schedule list client edge tests passed');
