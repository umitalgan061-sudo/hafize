import assert from 'node:assert/strict';
import {
  boundScheduleListOutput,
  normalizeScheduleListLimit
} from '../lib/schedule-list-boundary.mjs';

const schedule = (id, status, time) => ({
  scheduleId: `schedule_${id}`,
  status,
  runAt: time,
  createdAt: time,
  updatedAt: null
});

assert.equal(normalizeScheduleListLimit(), 200);
assert.equal(normalizeScheduleListLimit(1), 1);
assert.equal(normalizeScheduleListLimit(500), 500);
assert.throws(() => normalizeScheduleListLimit(0), /INVALID_SCHEDULE_LIST_LIMIT/);
assert.throws(() => normalizeScheduleListLimit(501), /INVALID_SCHEDULE_LIST_LIMIT/);
assert.throws(() => normalizeScheduleListLimit(1.5), /INVALID_SCHEDULE_LIST_LIMIT/);

const unchanged = { ok: true, schedules: [schedule(1, 'completed', '2026-08-18T01:00:00Z')] };
assert.equal(boundScheduleListOutput(unchanged), unchanged);
assert.equal(boundScheduleListOutput({ ok: false, error: 'x' }).error, 'x');

const many = {
  ok: true,
  schedules: [
    schedule(1, 'completed', '2026-08-18T01:00:00Z'),
    schedule(2, 'scheduled', '2026-08-20T01:00:00Z'),
    schedule(3, 'failed', '2026-08-18T03:00:00Z'),
    schedule(4, 'running', '2026-08-19T01:00:00Z'),
    schedule(5, 'cancelled', '2026-08-18T05:00:00Z')
  ]
};
const bounded = boundScheduleListOutput(many, { limit: 3 });
assert.deepEqual(bounded.schedules.map((item) => item.scheduleId), ['schedule_2', 'schedule_4', 'schedule_5']);
assert.deepEqual(bounded.listMeta, { returned: 3, total: 5, truncated: true });
assert.equal(many.schedules.length, 5, 'input must not be mutated');

console.log('schedule list boundary: ok');
