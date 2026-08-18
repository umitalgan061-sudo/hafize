import assert from 'node:assert/strict';
import { boundScheduleListOutput } from '../lib/schedule-list-boundary.mjs';

function makeSchedules(count) {
  return Array.from({ length: count }, (_, index) => ({
    scheduleId: `schedule_${index + 1}`,
    status: index < 3 ? 'scheduled' : 'completed',
    createdAt: `2026-08-18T08:${String(index).padStart(2, '0')}:00.000Z`,
    updatedAt: `2026-08-18T08:${String(index).padStart(2, '0')}:00.000Z`,
    runAt: '2026-08-18T15:00:00.000Z'
  }));
}

const original = makeSchedules(12);
const first = boundScheduleListOutput({ ok: true, schedules: original }, { limit: 4 });
assert.equal(first.listMeta.nextOffset, 4);

const stableSecond = boundScheduleListOutput({ ok: true, schedules: original }, {
  limit: 4,
  offset: 4,
  snapshot: first.listMeta.snapshot
});
assert.equal(stableSecond.ok, true);
assert.equal(new Set([...first.schedules, ...stableSecond.schedules].map((item) => item.scheduleId)).size, 8);

const transition = original.map((item) => ({ ...item }));
transition[5].status = 'running';
transition[5].updatedAt = '2026-08-18T10:00:00.000Z';
assert.deepEqual(
  boundScheduleListOutput({ ok: true, schedules: transition }, {
    limit: 4,
    offset: 4,
    snapshot: first.listMeta.snapshot
  }),
  { ok: false, error: 'SCHEDULE_LIST_SNAPSHOT_CHANGED' },
  'terminal-to-active transition must invalidate pagination snapshot'
);

const rescheduled = original.map((item) => ({ ...item }));
rescheduled[1].runAt = '2026-08-19T09:00:00.000Z';
rescheduled[1].updatedAt = '2026-08-18T10:01:00.000Z';
assert.deepEqual(
  boundScheduleListOutput({ ok: true, schedules: rescheduled }, {
    limit: 4,
    offset: 4,
    snapshot: first.listMeta.snapshot
  }),
  { ok: false, error: 'SCHEDULE_LIST_SNAPSHOT_CHANGED' },
  'reschedule must invalidate pagination snapshot'
);

const cancelled = original.map((item) => ({ ...item }));
cancelled[0].status = 'cancelled';
cancelled[0].updatedAt = '2026-08-18T10:02:00.000Z';
assert.deepEqual(
  boundScheduleListOutput({ ok: true, schedules: cancelled }, {
    limit: 4,
    offset: 4,
    snapshot: first.listMeta.snapshot
  }),
  { ok: false, error: 'SCHEDULE_LIST_SNAPSHOT_CHANGED' },
  'cancel must invalidate pagination snapshot'
);

const retryPolicyChanged = original.map((item) => ({ ...item }));
retryPolicyChanged[2].retryDelayMs = 300000;
retryPolicyChanged[2].updatedAt = '2026-08-18T10:03:00.000Z';
assert.deepEqual(
  boundScheduleListOutput({ ok: true, schedules: retryPolicyChanged }, {
    limit: 4,
    offset: 4,
    snapshot: first.listMeta.snapshot
  }),
  { ok: false, error: 'SCHEDULE_LIST_SNAPSHOT_CHANGED' },
  'updatedAt mutation must invalidate snapshot even when ordering category is unchanged'
);

const restarted = boundScheduleListOutput({ ok: true, schedules: retryPolicyChanged }, { limit: 4 });
assert.equal(restarted.ok, true);
assert.notEqual(restarted.listMeta.snapshot, first.listMeta.snapshot);
const restartedSecond = boundScheduleListOutput({ ok: true, schedules: retryPolicyChanged }, {
  limit: 4,
  offset: restarted.listMeta.nextOffset,
  snapshot: restarted.listMeta.snapshot
});
assert.equal(restartedSecond.ok, true, 'client can restart from first page after 409');

console.log('schedule list snapshot mutation tests passed');
