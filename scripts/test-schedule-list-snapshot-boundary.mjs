import assert from 'node:assert/strict';
import {
  boundScheduleListOutput,
  createScheduleListSnapshot,
  normalizeScheduleListSnapshot,
  orderedSchedules,
  SCHEDULE_LIST_SNAPSHOT_LENGTH
} from '../lib/schedule-list-boundary.mjs';

function schedule(id, status, updatedAt) {
  return {
    scheduleId: `schedule_${id}`,
    status,
    updatedAt,
    createdAt: '2026-08-18T08:00:00.000Z',
    runAt: '2026-08-18T13:00:00.000Z'
  };
}

const schedules = [
  schedule(1, 'completed', '2026-08-18T08:01:00.000Z'),
  schedule(2, 'scheduled', '2026-08-18T08:02:00.000Z'),
  schedule(3, 'failed', '2026-08-18T08:03:00.000Z'),
  schedule(4, 'running', '2026-08-18T08:04:00.000Z'),
  schedule(5, 'completed', '2026-08-18T08:05:00.000Z')
];

const ordered = orderedSchedules(schedules);
assert.deepEqual(ordered.map((entry) => entry.scheduleId), [
  'schedule_4', 'schedule_2', 'schedule_5', 'schedule_3', 'schedule_1'
]);

const snapshot = createScheduleListSnapshot(ordered);
assert.equal(snapshot.length, SCHEDULE_LIST_SNAPSHOT_LENGTH);
assert.equal(normalizeScheduleListSnapshot(snapshot), snapshot);
assert.equal(createScheduleListSnapshot(ordered), snapshot, 'same ordered list must have deterministic snapshot');

const first = boundScheduleListOutput({ ok: true, schedules }, { limit: 2 });
assert.equal(first.ok, true);
assert.equal(first.schedules.length, 2);
assert.equal(first.listMeta.offset, 0);
assert.equal(first.listMeta.nextOffset, 2);
assert.equal(first.listMeta.snapshot, snapshot);

const second = boundScheduleListOutput({ ok: true, schedules }, {
  limit: 2,
  offset: first.listMeta.nextOffset,
  snapshot: first.listMeta.snapshot
});
assert.equal(second.ok, true);
assert.deepEqual(second.schedules.map((entry) => entry.scheduleId), ['schedule_5', 'schedule_3']);
assert.equal(second.listMeta.nextOffset, 4);
assert.equal(second.listMeta.snapshot, snapshot);

const third = boundScheduleListOutput({ ok: true, schedules }, {
  limit: 2,
  offset: second.listMeta.nextOffset,
  snapshot: second.listMeta.snapshot
});
assert.deepEqual(third.schedules.map((entry) => entry.scheduleId), ['schedule_1']);
assert.equal(third.listMeta.nextOffset, null);

const changed = schedules.map((entry) => ({ ...entry }));
changed[0].status = 'running';
changed[0].updatedAt = '2026-08-18T08:30:00.000Z';
assert.notEqual(createScheduleListSnapshot(orderedSchedules(changed)), snapshot);
assert.deepEqual(
  boundScheduleListOutput({ ok: true, schedules: changed }, { limit: 2, offset: 2, snapshot }),
  { ok: false, error: 'SCHEDULE_LIST_SNAPSHOT_CHANGED' }
);

const added = schedules.concat(schedule(6, 'scheduled', '2026-08-18T08:40:00.000Z'));
assert.deepEqual(
  boundScheduleListOutput({ ok: true, schedules: added }, { limit: 2, offset: 2, snapshot }),
  { ok: false, error: 'SCHEDULE_LIST_SNAPSHOT_CHANGED' }
);

const removed = schedules.slice(1);
assert.deepEqual(
  boundScheduleListOutput({ ok: true, schedules: removed }, { limit: 2, offset: 2, snapshot }),
  { ok: false, error: 'SCHEDULE_LIST_SNAPSHOT_CHANGED' }
);

assert.throws(
  () => boundScheduleListOutput({ ok: true, schedules }, { limit: 2, offset: 2 }),
  /SCHEDULE_LIST_SNAPSHOT_REQUIRED/
);
for (const invalid of ['', 'a'.repeat(42), 'a'.repeat(44), 'A+B'.padEnd(43, 'A'), 123]) {
  assert.throws(() => normalizeScheduleListSnapshot(invalid), /INVALID_SCHEDULE_LIST_SNAPSHOT/);
}

const small = { ok: true, schedules: schedules.slice(0, 2) };
assert.equal(boundScheduleListOutput(small, { limit: 200 }), small, 'non-truncated first page keeps legacy shape');

console.log('schedule list snapshot boundary tests passed');
