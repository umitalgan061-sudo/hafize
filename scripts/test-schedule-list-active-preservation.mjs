import assert from 'node:assert/strict';
import { boundScheduleListOutput } from '../lib/schedule-list-boundary.mjs';

const make = (id, status, day) => ({
  scheduleId: `schedule_${id}`,
  status,
  runAt: `2026-09-${String(day).padStart(2, '0')}T10:00:00Z`,
  createdAt: `2026-08-${String(Math.min(day, 28)).padStart(2, '0')}T10:00:00Z`,
  updatedAt: null
});

const schedules = [];
for (let id = 1; id <= 90; id += 1) schedules.push(make(id, 'scheduled', (id % 28) + 1));
for (let id = 91; id <= 100; id += 1) schedules.push(make(id, 'running', (id % 28) + 1));
for (let id = 101; id <= 350; id += 1) schedules.push(make(id, 'completed', (id % 28) + 1));

const output = boundScheduleListOutput({ ok: true, schedules });
assert.equal(output.schedules.length, 200);
assert.equal(output.schedules.filter((entry) => entry.status === 'scheduled').length, 90);
assert.equal(output.schedules.filter((entry) => entry.status === 'running').length, 10);
assert.equal(output.schedules.filter((entry) => entry.status === 'completed').length, 100);
assert.equal(output.listMeta.total, 350);
assert.equal(output.listMeta.returned, 200);
assert.equal(output.listMeta.truncated, true);

const activeIds = new Set(schedules.filter((entry) => entry.status !== 'completed').map((entry) => entry.scheduleId));
for (const id of activeIds) {
  assert(output.schedules.some((entry) => entry.scheduleId === id), `missing active schedule ${id}`);
}

const activeOverflow = Array.from({ length: 205 }, (_, index) => make(index + 1, 'scheduled', (index % 28) + 1));
const overflow = boundScheduleListOutput({ ok: true, schedules: activeOverflow });
assert.equal(overflow.schedules.length, 200);
assert.equal(overflow.schedules.every((entry) => entry.status === 'scheduled'), true);

console.log('schedule list active preservation: ok');
