import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const api = require('../public/schedule-list.js');

const first = api.createListPath();
const firstUrl = new URL(first, 'https://hafize.example');
assert.equal(firstUrl.pathname, '/api/schedules');
assert.equal(firstUrl.searchParams.get('limit'), '100');
assert.equal(firstUrl.searchParams.get('view'), 'summary');
assert.equal(firstUrl.searchParams.has('offset'), false);
assert.equal(firstUrl.searchParams.has('snapshot'), false);
assert.deepEqual([...firstUrl.searchParams.keys()].sort(), ['limit', 'view']);

const snapshot = 'A'.repeat(43);
const next = api.createListPath({ offset: 100, snapshot });
const nextUrl = new URL(next, 'https://hafize.example');
assert.equal(nextUrl.pathname, '/api/schedules');
assert.equal(nextUrl.searchParams.get('limit'), '100');
assert.equal(nextUrl.searchParams.get('view'), 'summary');
assert.equal(nextUrl.searchParams.get('offset'), '100');
assert.equal(nextUrl.searchParams.get('snapshot'), snapshot);
assert.deepEqual([...nextUrl.searchParams.keys()].sort(), ['limit', 'offset', 'snapshot', 'view']);

assert.throws(() => api.createListPath({ offset: -1 }), /INVALID_SCHEDULE_LIST_OFFSET/);
assert.throws(() => api.createListPath({ offset: 10_001 }), /INVALID_SCHEDULE_LIST_OFFSET/);
assert.throws(() => api.createListPath({ offset: 100 }), /INVALID_SCHEDULE_LIST_SNAPSHOT/);
assert.throws(() => api.createListPath({ offset: 0, snapshot }), /INVALID_SCHEDULE_LIST_SNAPSHOT/);
assert.throws(() => api.createListPath({ offset: 100, snapshot: 'bad' }), /INVALID_SCHEDULE_LIST_SNAPSHOT/);

const calls = [];
const client = api.createClient({
  fetchImpl: async (path, options) => {
    calls.push({ path, options });
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          ok: true,
          view: 'summary',
          schedules: [],
          listMeta: { returned: 0, total: 0, offset: 0, nextOffset: null, truncated: false, snapshot }
        };
      }
    };
  }
});
const result = await client.list();
assert.equal(result.ok, true);
assert.equal(result.status, 200);
assert.equal(calls.length, 1);
assert.match(calls[0].path, /(?:\?|&)view=summary(?:&|$)/);
assert.deepEqual(calls[0].options, {
  method: 'GET',
  headers: { Accept: 'application/json' },
  credentials: 'same-origin',
  cache: 'no-store'
});
assert.equal('body' in calls[0].options, false);

const normalized = api.normalizeSchedule({
  scheduleId: 'schedule_1',
  agentId: 'minimal-engineer',
  task: 'Sunucuda kısaltılmış görev…',
  taskTruncated: true,
  runAt: '2026-08-18T15:00:00.000Z',
  status: 'scheduled',
  attempts: 0,
  maxAttempts: 3
});
assert.equal(normalized.task, 'Sunucuda kısaltılmış görev…');
assert.equal(normalized.scheduleId, 'schedule_1');
assert.equal(normalized.maxAttempts, 3);

const source = await readFile(new URL('../public/schedule-list.js', import.meta.url), 'utf8');
assert.match(source, /new URLSearchParams\(\{ limit: String\(PAGE_SIZE\), view: 'summary' \}\)/);
for (const forbidden of [
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'document.cookie',
  'Authorization',
  'Bearer ',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'sendBeacon',
  'innerHTML',
  'outerHTML',
  'insertAdjacentHTML'
]) assert.equal(source.includes(forbidden), false, `schedule list UI contains forbidden surface: ${forbidden}`);

assert.equal(source.includes("method: 'POST'"), false);
assert.equal(source.includes("method: 'PATCH'"), false);
assert.equal(source.includes("method: 'DELETE'"), false);
assert.equal(source.includes('ownerId'), false);
assert.equal(source.includes('traceId'), false);
assert.equal(source.includes('lastError'), false);

console.log('schedule list summary UI tests passed');
