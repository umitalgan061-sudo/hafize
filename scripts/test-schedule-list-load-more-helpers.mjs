import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function loadScheduleList() {
  const source = await readFile(new URL('../public/schedule-list.js', import.meta.url), 'utf8');
  const module = { exports: {} };
  const context = vm.createContext({
    module,
    URLSearchParams,
    Intl,
    Date,
    Set,
    Map,
    Object,
    Number,
    String,
    Array,
    console
  });
  vm.runInContext(source, context, { filename: 'schedule-list.js' });
  return module.exports;
}

function raw(id, overrides = {}) {
  return {
    scheduleId: `schedule_${id}`,
    agentId: 'minimal-engineer',
    task: `Görev ${id}`,
    runAt: `2026-08-19T${String(id % 24).padStart(2, '0')}:00:00.000Z`,
    status: 'completed',
    attempts: 1,
    maxAttempts: 1,
    ...overrides
  };
}

const api = await loadScheduleList();
assert.equal(api.PAGE_SIZE, 100);
assert.equal(api.MAX_ITEMS, 500);
assert.match('A'.repeat(43), api.SNAPSHOT_PATTERN);
assert.equal(api.createListPath(), '/api/schedules?limit=100');
assert.equal(
  api.createListPath({ offset: 100, snapshot: 'A'.repeat(43) }),
  `/api/schedules?limit=100&offset=100&snapshot=${'A'.repeat(43)}`
);
assert.throws(() => api.createListPath({ offset: 100 }), /INVALID_SCHEDULE_LIST_SNAPSHOT/);
assert.throws(() => api.createListPath({ offset: -1 }), /INVALID_SCHEDULE_LIST_OFFSET/);
assert.throws(() => api.createListPath({ offset: 0, snapshot: 'A'.repeat(43) }), /INVALID_SCHEDULE_LIST_SNAPSHOT/);
assert.throws(() => api.createListPath({ offset: 100, snapshot: 'x'.repeat(42) }), /INVALID_SCHEDULE_LIST_SNAPSHOT/);

assert.deepEqual(
  { ...api.normalizeListMeta({ listMeta: { snapshot: 'B'.repeat(43), nextOffset: 100, total: 720 } }) },
  { snapshot: 'B'.repeat(43), nextOffset: 100, total: 720 }
);
assert.deepEqual(
  { ...api.normalizeListMeta({ listMeta: { snapshot: 'bad', nextOffset: 100, total: 720 } }) },
  { snapshot: null, nextOffset: null, total: 720 },
  'nextOffset cannot survive without a valid snapshot'
);
assert.deepEqual(
  { ...api.normalizeListMeta({ listMeta: { snapshot: 'B'.repeat(43), nextOffset: 10001, total: 720 } }) },
  { snapshot: 'B'.repeat(43), nextOffset: null, total: 720 }
);

const first = api.normalizeSchedules({ schedules: [raw(1), raw(2), raw(3)] });
const second = api.normalizeSchedules({ schedules: [raw(3, { task: 'duplicate must not replace' }), raw(4), raw(5)] });
const merged = api.mergeSchedules(first, second);
assert.equal(merged.length, 5);
assert.equal(merged.filter((item) => item.scheduleId === 'schedule_3').length, 1);
assert.equal(merged.find((item) => item.scheduleId === 'schedule_3').task, 'Görev 3');

const many = Array.from({ length: 550 }, (_, index) => raw(index + 1));
const bounded = api.mergeSchedules([], api.normalizeSchedules({ schedules: many }));
assert.equal(bounded.length, 500, 'UI must never retain more than 500 schedule cards');

for (const invalidMeta of [null, {}, [], { listMeta: 'x' }, { listMeta: { snapshot: '<script>', nextOffset: 2 } }]) {
  const meta = api.normalizeListMeta(invalidMeta);
  assert.equal(meta.nextOffset, null);
}

console.log('schedule list load-more helper tests passed');
