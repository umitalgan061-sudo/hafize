import assert from 'node:assert/strict';
import { recoverInterruptedScheduleSnapshot, RESTART_ERROR } from '../lib/schedule-restart-recovery.mjs';

const input = {
  entries: [
    { scheduleId: 'schedule_1', status: 'running', attempts: 1, maxAttempts: 1, lastError: null, task: 'a' },
    { scheduleId: 'schedule_2', status: 'running', attempts: 3, maxAttempts: 5, lastError: 'OLD', task: 'b' },
    { scheduleId: 'schedule_3', status: 'scheduled', attempts: 0, maxAttempts: 2, lastError: null, task: 'c' },
    { scheduleId: 'schedule_4', status: 'completed', attempts: 1, maxAttempts: 1, lastError: null, task: 'd' }
  ]
};
const result = recoverInterruptedScheduleSnapshot(input);
assert.equal(result.recovered, 2);
assert.deepEqual(result.snapshot.entries.map(({ status, attempts, lastError }) => ({ status, attempts, lastError })), [
  { status: 'scheduled', attempts: 0, lastError: RESTART_ERROR },
  { status: 'scheduled', attempts: 2, lastError: RESTART_ERROR },
  { status: 'scheduled', attempts: 0, lastError: null },
  { status: 'completed', attempts: 1, lastError: null }
]);
assert.equal(input.entries[0].status, 'running');
assert.equal(input.entries[0].attempts, 1);
assert.notEqual(result.snapshot.entries[0], input.entries[0]);
for (const bad of [null, [], {}, { entries: {} }]) {
  assert.throws(() => recoverInterruptedScheduleSnapshot(bad), /INVALID_SCHEDULE_RESTART_SNAPSHOT/);
}
assert.throws(() => recoverInterruptedScheduleSnapshot({ entries: [null] }), /INVALID_SCHEDULE_RESTART_ENTRY/);
assert.throws(() => recoverInterruptedScheduleSnapshot({ entries: [{ status: 'running', attempts: 0, maxAttempts: 1 }] }), /INVALID_SCHEDULE_RESTART_ATTEMPTS/);
assert.throws(() => recoverInterruptedScheduleSnapshot({ entries: [{ status: 'running', attempts: 2, maxAttempts: 1 }] }), /INVALID_SCHEDULE_RESTART_ATTEMPTS/);
console.log('schedule restart recovery ok');
