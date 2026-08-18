import assert from 'node:assert/strict';
import {
  MAX_SCHEDULE_SCOPE_COUNT,
  attachScheduleListScopeCounts,
  createScheduleListScopeCounts,
  normalizeScheduleListScopeCounts
} from '../lib/schedule-list-scope.mjs';

function schedule(scheduleId, status) {
  return { scheduleId, status };
}

const source = {
  ok: true,
  schedules: [
    schedule('schedule_1', 'scheduled'),
    schedule('schedule_2', 'running'),
    schedule('schedule_3', 'completed'),
    schedule('schedule_4', 'failed'),
    schedule('schedule_5', 'cancelled')
  ],
  ownerId: 'must-not-be-copied-by-count-helper',
  traceId: 'trace_private'
};

const counts = createScheduleListScopeCounts(source);
assert.deepEqual(counts, { all: 5, active: 2, history: 3, failed: 1 });
assert.equal(Object.isFrozen(counts), true);
assert.deepEqual(source.schedules.map((item) => item.status), ['scheduled', 'running', 'completed', 'failed', 'cancelled']);

assert.equal(createScheduleListScopeCounts({ ok: false, error: 'NOPE' }), null);
assert.equal(createScheduleListScopeCounts({ ok: true, schedules: null }), null);

assert.deepEqual(normalizeScheduleListScopeCounts({ all: 5, active: 2, history: 3, failed: 1 }), counts);
for (const invalid of [
  null,
  [],
  {},
  { all: 5, active: 2, history: 3, failed: -1 },
  { all: 5, active: 6, history: 0, failed: 0 },
  { all: 5, active: 2, history: 2, failed: 0 },
  { all: 5, active: 2, history: 3, failed: 4 },
  { all: 5, active: 2, history: 3, failed: 1.5 },
  { all: MAX_SCHEDULE_SCOPE_COUNT + 1, active: 0, history: 0, failed: 0 }
]) assert.equal(normalizeScheduleListScopeCounts(invalid), null);

const projected = {
  ok: true,
  schedules: [{ scheduleId: 'schedule_1' }],
  listMeta: { returned: 1, total: 5, snapshot: 'x'.repeat(43) }
};
const attached = attachScheduleListScopeCounts(projected, counts);
assert.notEqual(attached, projected);
assert.deepEqual(attached.listMeta.scopeCounts, counts);
assert.equal(attached.listMeta.returned, 1);
assert.equal(attached.listMeta.total, 5);
assert.equal(attached.listMeta.snapshot, 'x'.repeat(43));
assert.equal('ownerId' in attached.listMeta.scopeCounts, false);
assert.equal('traceId' in attached.listMeta.scopeCounts, false);
assert.equal('schedules' in attached.listMeta.scopeCounts, false);

const noMeta = attachScheduleListScopeCounts({ ok: true, schedules: [] }, { all: 0, active: 0, history: 0, failed: 0 });
assert.deepEqual(noMeta.listMeta.scopeCounts, { all: 0, active: 0, history: 0, failed: 0 });
assert.deepEqual(attachScheduleListScopeCounts({ ok: false, error: 'X' }, counts), { ok: false, error: 'X' });
assert.throws(
  () => attachScheduleListScopeCounts({ ok: true, schedules: [] }, { all: 2, active: 2, history: 2, failed: 0 }),
  /INVALID_SCHEDULE_LIST_SCOPE_COUNTS/
);

const oversized = {
  ok: true,
  schedules: Array.from({ length: MAX_SCHEDULE_SCOPE_COUNT + 1 }, (_, index) => schedule(`schedule_${index + 1}`, 'completed'))
};
assert.throws(() => createScheduleListScopeCounts(oversized), /SCHEDULE_LIST_SCOPE_COUNT_TOO_LARGE/);

process.stdout.write('schedule list scope counts tests passed\n');
