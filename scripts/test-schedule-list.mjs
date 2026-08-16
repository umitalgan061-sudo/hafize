import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const scheduleList = require('../public/schedule-list.js');

assert.equal(scheduleList.PATH, '/api/schedules');
assert.equal(scheduleList.MAX_ITEMS, 100);
assert.equal(scheduleList.MAX_TASK_PREVIEW_CHARS, 180);
assert.equal(scheduleList.MAX_AGENT_ID_CHARS, 120);
assert.equal(scheduleList.MAX_SCHEDULE_ID_CHARS, 120);

assert.equal(scheduleList.normalizeTaskPreview('  Ankara   hava  durumunu kontrol et  '), 'Ankara hava durumunu kontrol et');
assert.equal(scheduleList.normalizeTaskPreview(''), null);
assert.equal(scheduleList.normalizeTaskPreview(null), null);
const longTask = 'a'.repeat(240);
const preview = scheduleList.normalizeTaskPreview(longTask);
assert.equal(preview.length, 180);
assert.equal(preview.endsWith('…'), true);

assert.equal(scheduleList.normalizeIso('2026-08-16T18:00:00Z'), '2026-08-16T18:00:00.000Z');
assert.equal(scheduleList.normalizeIso('not-a-date'), null);
assert.equal(scheduleList.normalizeIso(null), null);

const valid = scheduleList.normalizeSchedule({
  scheduleId: 'schedule_7',
  agentId: 'minimal-engineer',
  task: 'GitHub durumunu kontrol et',
  runAt: '2026-08-16T19:00:00Z',
  status: 'scheduled',
  attempts: 0,
  maxAttempts: 3,
  traceId: 'not-exposed',
  lastError: 'NOT_EXPOSED'
});
assert.deepEqual(valid, {
  scheduleId: 'schedule_7',
  agentId: 'minimal-engineer',
  task: 'GitHub durumunu kontrol et',
  runAt: '2026-08-16T19:00:00.000Z',
  status: 'scheduled',
  attempts: 0,
  maxAttempts: 3
});
assert.equal(Object.hasOwn(valid, 'traceId'), false);
assert.equal(Object.hasOwn(valid, 'lastError'), false);

for (const invalid of [
  null,
  [],
  {},
  { ...valid, status: 'unknown' },
  { ...valid, attempts: -1 },
  { ...valid, maxAttempts: 6 },
  { ...valid, attempts: 4, maxAttempts: 3 },
  { ...valid, scheduleId: '' },
  { ...valid, agentId: '' },
  { ...valid, runAt: 'invalid' },
  { ...valid, task: '' }
]) assert.equal(scheduleList.normalizeSchedule(invalid), null);

const normalized = scheduleList.normalizeSchedules({ schedules: [
  { ...valid, scheduleId: 'schedule_3', runAt: '2026-08-18T10:00:00Z' },
  { ...valid, scheduleId: 'schedule_1', runAt: '2026-08-17T10:00:00Z' },
  { ...valid, scheduleId: 'schedule_1', runAt: '2026-08-16T10:00:00Z', task: 'duplicate' },
  { ...valid, scheduleId: 'schedule_2', runAt: '2026-08-17T09:00:00Z', status: 'completed', attempts: 1 }
] });
assert.deepEqual(normalized.map((item) => item.scheduleId), ['schedule_2', 'schedule_1', 'schedule_3']);
assert.equal(normalized.find((item) => item.scheduleId === 'schedule_1').task, valid.task);
assert.deepEqual(scheduleList.normalizeSchedules({ schedules: null }), []);
assert.deepEqual(scheduleList.normalizeSchedules(null), []);

const many = Array.from({ length: 130 }, (_, index) => ({
  ...valid,
  scheduleId: `schedule_${index + 1}`,
  runAt: new Date(Date.UTC(2026, 7, 16, 12, index)).toISOString()
}));
assert.equal(scheduleList.normalizeSchedules({ schedules: many }).length, 100);

assert.equal(scheduleList.statusText(valid), 'Planlandı · en fazla 3 deneme');
assert.equal(scheduleList.statusText({ ...valid, status: 'running', attempts: 1 }), 'Çalışıyor · deneme 1/3');
assert.equal(scheduleList.statusText({ ...valid, status: 'failed', attempts: 3 }), 'Başarısız · deneme 3/3');
assert.equal(scheduleList.statusText({ ...valid, status: 'completed', attempts: 1 }), 'Tamamlandı');
assert.equal(scheduleList.statusText({ ...valid, status: 'cancelled' }), 'İptal edildi');
assert.equal(scheduleList.statusText({ ...valid, status: 'weird' }), 'Durum bilinmiyor');

const calls = [];
const client = scheduleList.createClient({
  fetchImpl: async (path, init) => {
    calls.push({ path, init });
    return {
      ok: true,
      status: 200,
      async json() { return { ok: true, schedules: [] }; }
    };
  }
});
const response = await client.list();
assert.equal(response.ok, true);
assert.equal(response.status, 200);
assert.deepEqual(response.payload, { ok: true, schedules: [] });
assert.equal(calls.length, 1);
assert.equal(calls[0].path, '/api/schedules');
assert.equal(calls[0].init.method, 'GET');
assert.equal(calls[0].init.credentials, 'same-origin');
assert.equal(calls[0].init.cache, 'no-store');
assert.deepEqual(calls[0].init.headers, { Accept: 'application/json' });

await assert.rejects(async () => scheduleList.createClient({ fetchImpl: null }), /INVALID_SCHEDULE_LIST_FETCH/);

console.log('schedule list helper tests passed');
