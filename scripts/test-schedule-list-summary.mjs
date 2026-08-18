import assert from 'node:assert/strict';
import {
  MAX_SUMMARY_TASK_BYTES,
  MAX_SUMMARY_TASK_CHARS,
  SUMMARY_VIEW,
  normalizeScheduleListView,
  summarizeSchedule,
  summarizeScheduleListOutput,
  truncateUtf8
} from '../lib/schedule-list-summary.mjs';

function schedule(overrides = {}) {
  return {
    scheduleId: 'schedule_1',
    ownerId: 'owner-secret-canary',
    agentId: 'minimal-engineer',
    task: 'Ankara hava durumunu özetle',
    runAt: '2026-08-18T14:00:00.000Z',
    status: 'scheduled',
    attempts: 0,
    maxAttempts: 3,
    retryDelayMs: 60_000,
    traceId: 'trace-secret-canary',
    lastError: 'private-provider-error-canary',
    result: { content: 'private-result-canary' },
    createdAt: '2026-08-18T12:00:00.000Z',
    updatedAt: '2026-08-18T12:30:00.000Z',
    ...overrides
  };
}

assert.equal(normalizeScheduleListView(), null);
assert.equal(normalizeScheduleListView(null), null);
assert.equal(normalizeScheduleListView(''), null);
assert.equal(normalizeScheduleListView('summary'), SUMMARY_VIEW);
assert.throws(() => normalizeScheduleListView('full'), /INVALID_SCHEDULE_LIST_VIEW/);
assert.throws(() => normalizeScheduleListView('SUMMARY'), /INVALID_SCHEDULE_LIST_VIEW/);

const plain = truncateUtf8('  bir   iki\nüç  ');
assert.deepEqual(plain, { text: 'bir iki üç', truncated: false });

const longAscii = truncateUtf8('x'.repeat(MAX_SUMMARY_TASK_CHARS + 20));
assert.equal(longAscii.truncated, true);
assert.equal(Array.from(longAscii.text).length, MAX_SUMMARY_TASK_CHARS);
assert.equal(longAscii.text.endsWith('…'), true);
assert.ok(Buffer.byteLength(longAscii.text, 'utf8') <= MAX_SUMMARY_TASK_BYTES);

const emoji = truncateUtf8('🛰️'.repeat(300));
assert.equal(emoji.truncated, true);
assert.ok(Array.from(emoji.text).length <= MAX_SUMMARY_TASK_CHARS);
assert.ok(Buffer.byteLength(emoji.text, 'utf8') <= MAX_SUMMARY_TASK_BYTES);
assert.equal(emoji.text.endsWith('…'), true);

const control = truncateUtf8('görev\u0000\u0007\tmetni');
assert.equal(control.text, 'görev metni');
assert.equal(control.truncated, false);
assert.equal(truncateUtf8('\u0000\n\t'), null);
assert.equal(truncateUtf8(null), null);

const item = summarizeSchedule(schedule());
assert.deepEqual(Object.keys(item), [
  'scheduleId',
  'agentId',
  'task',
  'taskTruncated',
  'runAt',
  'status',
  'attempts',
  'maxAttempts'
]);
assert.equal(item.scheduleId, 'schedule_1');
assert.equal(item.agentId, 'minimal-engineer');
assert.equal(item.task, 'Ankara hava durumunu özetle');
assert.equal(item.taskTruncated, false);
assert.equal(item.runAt, '2026-08-18T14:00:00.000Z');
assert.equal(item.status, 'scheduled');
assert.equal(item.attempts, 0);
assert.equal(item.maxAttempts, 3);
assert.equal(Object.prototype.hasOwnProperty.call(item, 'ownerId'), false);
assert.equal(Object.prototype.hasOwnProperty.call(item, 'traceId'), false);
assert.equal(Object.prototype.hasOwnProperty.call(item, 'lastError'), false);
assert.equal(Object.prototype.hasOwnProperty.call(item, 'result'), false);
assert.equal(Object.prototype.hasOwnProperty.call(item, 'retryDelayMs'), false);
assert.equal(Object.prototype.hasOwnProperty.call(item, 'createdAt'), false);
assert.equal(Object.prototype.hasOwnProperty.call(item, 'updatedAt'), false);

assert.equal(summarizeSchedule(schedule({ scheduleId: 'bad\nvalue' })), null);
assert.equal(summarizeSchedule(schedule({ agentId: 'bad\tvalue' })), null);
assert.equal(summarizeSchedule(schedule({ task: '   ' })), null);
assert.equal(summarizeSchedule(schedule({ runAt: 'not-a-date' })), null);
assert.equal(summarizeSchedule(schedule({ status: 'unknown' })), null);
assert.equal(summarizeSchedule(schedule({ attempts: -1 })), null);
assert.equal(summarizeSchedule(schedule({ attempts: 4, maxAttempts: 3 })), null);
assert.equal(summarizeSchedule(schedule({ maxAttempts: 6 })), null);
assert.equal(summarizeSchedule(null), null);

const projected = summarizeScheduleListOutput({
  ok: true,
  schedules: [
    schedule(),
    schedule({ scheduleId: 'schedule_2', task: 'y'.repeat(20_000), status: 'completed', attempts: 1, maxAttempts: 1 }),
    schedule({ scheduleId: 'bad\nrecord' })
  ],
  listMeta: {
    returned: 3,
    total: 7,
    offset: 0,
    nextOffset: 3,
    truncated: true,
    snapshot: 'A'.repeat(43)
  },
  principal: 'should-not-survive'
});
assert.equal(projected.ok, true);
assert.equal(projected.view, 'summary');
assert.equal(projected.schedules.length, 2);
assert.equal(projected.listMeta.returned, 2);
assert.equal(projected.listMeta.total, 7);
assert.equal(projected.listMeta.nextOffset, 3);
assert.equal(projected.schedules[1].taskTruncated, true);
assert.ok(Array.from(projected.schedules[1].task).length <= MAX_SUMMARY_TASK_CHARS);
assert.ok(Buffer.byteLength(projected.schedules[1].task, 'utf8') <= MAX_SUMMARY_TASK_BYTES);

const serialized = JSON.stringify(projected);
for (const forbidden of [
  'owner-secret-canary',
  'trace-secret-canary',
  'private-provider-error-canary',
  'private-result-canary',
  'retryDelayMs',
  'ownerId',
  'traceId',
  'lastError',
  'result'
]) {
  assert.equal(serialized.includes(forbidden), false, `summary leaked ${forbidden}`);
}

const untouchedError = { ok: false, error: 'SCHEDULE_LIST_SNAPSHOT_CHANGED' };
assert.equal(summarizeScheduleListOutput(untouchedError), untouchedError);

console.log('schedule list summary projection tests passed');
