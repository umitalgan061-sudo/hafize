import assert from 'node:assert/strict';
import {
  SCHEDULE_LIST_SCOPES,
  filterScheduleListOutput,
  matchesScheduleListScope,
  normalizeScheduleListScope
} from '../lib/schedule-list-scope.mjs';

const statuses = ['scheduled', 'running', 'completed', 'failed', 'cancelled'];
const schedules = statuses.map((status, index) => ({ scheduleId: `schedule_${index + 1}`, status }));
const output = { ok: true, schedules, ownerId: 'must-stay-server-side' };

assert.equal(normalizeScheduleListScope(), 'all');
assert.equal(normalizeScheduleListScope(null), 'all');
for (const scope of ['all', 'active', 'history', 'failed']) {
  assert.equal(normalizeScheduleListScope(scope), scope);
}
for (const invalid of ['', 'ALL', 'scheduled', 'active,failed', ' active ', 1, {}, []]) {
  assert.throws(() => normalizeScheduleListScope(invalid), /INVALID_SCHEDULE_LIST_SCOPE/);
}

assert.equal(SCHEDULE_LIST_SCOPES.all, null);
assert.deepEqual([...SCHEDULE_LIST_SCOPES.active], ['scheduled', 'running']);
assert.deepEqual([...SCHEDULE_LIST_SCOPES.history], ['completed', 'failed', 'cancelled']);
assert.deepEqual([...SCHEDULE_LIST_SCOPES.failed], ['failed']);

assert.equal(filterScheduleListOutput(output, 'all'), output, 'all scope should preserve the command result object');
const active = filterScheduleListOutput(output, 'active');
assert.notEqual(active, output);
assert.deepEqual(active.schedules.map((entry) => entry.status), ['scheduled', 'running']);
assert.equal(active.ownerId, 'must-stay-server-side');
const history = filterScheduleListOutput(output, 'history');
assert.deepEqual(history.schedules.map((entry) => entry.status), ['completed', 'failed', 'cancelled']);
const failed = filterScheduleListOutput(output, 'failed');
assert.deepEqual(failed.schedules.map((entry) => entry.status), ['failed']);
assert.equal(output.schedules.length, 5, 'scope filtering must not mutate the source list');

for (const status of statuses) {
  const entry = { status };
  assert.equal(matchesScheduleListScope(entry, 'all'), true);
  assert.equal(matchesScheduleListScope(entry, 'active'), ['scheduled', 'running'].includes(status));
  assert.equal(matchesScheduleListScope(entry, 'history'), ['completed', 'failed', 'cancelled'].includes(status));
  assert.equal(matchesScheduleListScope(entry, 'failed'), status === 'failed');
}
assert.equal(matchesScheduleListScope({}, 'active'), false);

const failedCommand = { ok: false, error: 'AUTH_REQUIRED' };
assert.equal(filterScheduleListOutput(failedCommand, 'failed'), failedCommand);
const malformedCommand = { ok: true, schedules: null };
assert.equal(filterScheduleListOutput(malformedCommand, 'active'), malformedCommand);

console.log('schedule list scope helper tests passed');
