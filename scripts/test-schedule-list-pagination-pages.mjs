import assert from 'node:assert/strict';
import { boundScheduleListOutput } from '../lib/schedule-list-boundary.mjs';

const make = (id, status) => ({
  scheduleId: `schedule_${id}`,
  status,
  runAt: `2026-09-${String((id % 28) + 1).padStart(2, '0')}T10:00:00Z`,
  createdAt: `2026-08-${String((id % 28) + 1).padStart(2, '0')}T10:00:00Z`,
  updatedAt: null
});

const schedules = [];
for (let id = 1; id <= 100; id += 1) schedules.push(make(id, id <= 90 ? 'scheduled' : 'running'));
for (let id = 101; id <= 550; id += 1) schedules.push(make(id, 'completed'));
const output = { ok: true, schedules };

const page1 = boundScheduleListOutput(output, { limit: 200, offset: 0 });
const page2 = boundScheduleListOutput(output, { limit: 200, offset: page1.listMeta.nextOffset });
const page3 = boundScheduleListOutput(output, { limit: 200, offset: page2.listMeta.nextOffset });

assert.equal(page1.schedules.length, 200);
assert.equal(page2.schedules.length, 200);
assert.equal(page3.schedules.length, 150);
assert.equal(page1.listMeta.nextOffset, 200);
assert.equal(page2.listMeta.nextOffset, 400);
assert.equal(page3.listMeta.nextOffset, null);
assert.equal(page3.listMeta.total, 550);

const ids = [...page1.schedules, ...page2.schedules, ...page3.schedules].map((entry) => entry.scheduleId);
assert.equal(ids.length, 550);
assert.equal(new Set(ids).size, 550, 'pages must not duplicate schedules');
for (const active of schedules.slice(0, 100)) {
  assert(page1.schedules.some((entry) => entry.scheduleId === active.scheduleId), `active schedule not on first page: ${active.scheduleId}`);
}

const empty = boundScheduleListOutput(output, { limit: 200, offset: 10000 });
assert.deepEqual(empty.schedules, []);
assert.equal(empty.listMeta.returned, 0);
assert.equal(empty.listMeta.nextOffset, null);
assert.equal(empty.listMeta.total, 550);

console.log('schedule list pagination continuity: ok');
