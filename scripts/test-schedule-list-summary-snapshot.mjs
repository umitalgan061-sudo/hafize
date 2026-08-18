import assert from 'node:assert/strict';
import { boundScheduleListOutput } from '../lib/schedule-list-boundary.mjs';
import { summarizeScheduleListOutput } from '../lib/schedule-list-summary.mjs';

function task(index, status = 'scheduled') {
  return {
    scheduleId: `schedule_${index}`,
    agentId: 'minimal-engineer',
    task: `Görev ${index}`,
    runAt: `2026-08-18T${String(10 + index).padStart(2, '0')}:00:00.000Z`,
    status,
    attempts: status === 'completed' ? 1 : 0,
    maxAttempts: 3,
    createdAt: '2026-08-18T09:00:00.000Z',
    updatedAt: `2026-08-18T${String(9 + index).padStart(2, '0')}:30:00.000Z`
  };
}

const original = [task(1), task(2), task(3)];
const first = summarizeScheduleListOutput(boundScheduleListOutput(
  { ok: true, schedules: original },
  { limit: 2, offset: 0, snapshot: null }
));
assert.equal(first.view, 'summary');
assert.equal(first.schedules.length, 2);
assert.match(first.listMeta.snapshot, /^[A-Za-z0-9_-]{43}$/);

const stableNext = summarizeScheduleListOutput(boundScheduleListOutput(
  { ok: true, schedules: original },
  { limit: 2, offset: 2, snapshot: first.listMeta.snapshot }
));
assert.equal(stableNext.ok, true);
assert.equal(stableNext.schedules.length, 1);
assert.equal(stableNext.listMeta.snapshot, first.listMeta.snapshot);

const changed = [task(1), task(2, 'completed'), task(3)];
const staleNext = boundScheduleListOutput(
  { ok: true, schedules: changed },
  { limit: 2, offset: 2, snapshot: first.listMeta.snapshot }
);
assert.deepEqual(staleNext, { ok: false, error: 'SCHEDULE_LIST_SNAPSHOT_CHANGED' });
assert.equal(summarizeScheduleListOutput(staleNext), staleNext);

console.log('schedule list summary snapshot tests passed');
