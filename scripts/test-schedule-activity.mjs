import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const activity = require('../public/schedule-activity.js');

function item(overrides = {}) {
  return {
    scheduleId: 'schedule_1',
    agentId: 'personal_assistant',
    status: 'scheduled',
    attempts: 0,
    maxAttempts: 3,
    runAt: '2026-08-18T12:00:00.000Z',
    createdAt: '2026-08-17T10:00:00.000Z',
    updatedAt: null,
    ...overrides
  };
}

assert.equal(activity.MAX_ITEMS, 50);
assert.equal(activity.normalizeActivity(item())?.scheduleId, 'schedule_1');
assert.equal(activity.normalizeActivity(item({ status: 'unknown' })), null);
assert.equal(activity.normalizeActivity(item({ attempts: 4, maxAttempts: 3 })), null);
assert.equal(activity.normalizeActivity(item({ status: 'scheduled', attempts: 3, maxAttempts: 3 })), null);
assert.equal(activity.normalizeActivity(item({ status: 'running', attempts: 0 })), null);
assert.equal(activity.normalizeActivity(item({ runAt: 'not-a-date' })), null);
assert.equal(activity.normalizeActivity(item({ createdAt: null })), null);
assert.equal(activity.normalizeActivity(item({ updatedAt: 'bad-date' })), null);

assert.equal(activity.activityGroup('scheduled'), 'active');
assert.equal(activity.activityGroup('running'), 'active');
assert.equal(activity.activityGroup('completed'), 'history');
assert.equal(activity.activityGroup('failed'), 'history');
assert.equal(activity.activityGroup('cancelled'), 'history');

assert.equal(activity.activitySummary(item()), 'Henüz çalışmadı');
assert.match(activity.activitySummary(item({ attempts: 1 })), /Yeniden deneme bekliyor/);
assert.equal(activity.activitySummary(item({ status: 'running', attempts: 1 })), 'Deneme 1/3 çalışıyor');
assert.equal(activity.activitySummary(item({ status: 'completed', attempts: 2 })), 'Deneme 2/3 ile tamamlandı');
assert.equal(activity.activitySummary(item({ status: 'failed', attempts: 3 })), 'Deneme 3/3 sonrası başarısız');
assert.equal(activity.activitySummary(item({ status: 'cancelled', attempts: 0 })), 'Çalışmadan iptal edildi');

const payload = {
  schedules: [
    item({ scheduleId: 'schedule_1' }),
    item({ scheduleId: 'schedule_2', status: 'completed', attempts: 1, updatedAt: '2026-08-17T13:00:00.000Z' }),
    item({ scheduleId: 'schedule_3', status: 'running', attempts: 1, updatedAt: '2026-08-17T12:00:00.000Z' }),
    item({ scheduleId: 'schedule_2', status: 'failed', attempts: 3 })
  ]
};
const normalized = activity.normalizeActivities(payload);
assert.deepEqual(normalized.map((entry) => entry.scheduleId), ['schedule_2', 'schedule_3', 'schedule_1']);
assert.deepEqual(activity.filterActivities(normalized, 'active').map((entry) => entry.scheduleId), ['schedule_3', 'schedule_1']);
assert.deepEqual(activity.filterActivities(normalized, 'history').map((entry) => entry.scheduleId), ['schedule_2']);
assert.equal(activity.filterActivities(normalized, 'invalid').length, 3);
assert.equal(activity.latestChange(normalized[0]), '2026-08-17T13:00:00.000Z');
assert.equal(activity.latestChange(normalized[2]), '2026-08-17T10:00:00.000Z');

let request = null;
const client = activity.createClient({
  fetchImpl: async (path, options) => {
    request = { path, options };
    return { ok: true, status: 200, async json() { return { ok: true, schedules: [] }; } };
  }
});
const response = await client.list();
assert.equal(response.ok, true);
assert.equal(request.path, '/api/schedules');
assert.equal(request.options.method, 'GET');
assert.equal(request.options.credentials, 'same-origin');
assert.equal(request.options.cache, 'no-store');
assert.deepEqual(request.options.headers, { Accept: 'application/json' });
assert.equal(Object.hasOwn(request.options, 'body'), false);

console.log('schedule activity helper tests passed');
