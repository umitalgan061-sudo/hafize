import assert from 'node:assert/strict';
import { boundScheduleListOutput } from '../lib/schedule-list-boundary.mjs';
import {
  MAX_SUMMARY_TASK_BYTES,
  MAX_SUMMARY_TASK_CHARS,
  summarizeScheduleListOutput
} from '../lib/schedule-list-summary.mjs';

const COUNT = 500;
const hugeTask = 'x'.repeat(20_000);
const schedules = Array.from({ length: COUNT }, (_, index) => ({
  scheduleId: `schedule_${index + 1}`,
  ownerId: `owner-private-${index}`,
  agentId: index % 2 ? 'minimal-engineer' : 'movie-coordinator',
  task: hugeTask,
  runAt: new Date(Date.UTC(2026, 7, 19, 0, index % 60, 0)).toISOString(),
  status: index % 5 === 0 ? 'completed' : 'scheduled',
  attempts: index % 5 === 0 ? 1 : 0,
  maxAttempts: 3,
  retryDelayMs: 86_400_000,
  traceId: `trace-private-${index}`,
  lastError: `provider-private-${index}`,
  result: { text: `result-private-${index}` },
  createdAt: new Date(Date.UTC(2026, 7, 18, 0, index % 60, 0)).toISOString(),
  updatedAt: new Date(Date.UTC(2026, 7, 18, 1, index % 60, 0)).toISOString()
}));

const bounded = boundScheduleListOutput(
  { ok: true, schedules },
  { limit: COUNT, offset: 0, snapshot: null }
);
assert.equal(bounded.schedules.length, COUNT);
assert.equal(bounded.listMeta, undefined, 'exact-limit list preserves legacy no-meta response');

const summary = summarizeScheduleListOutput(bounded);
assert.equal(summary.ok, true);
assert.equal(summary.view, 'summary');
assert.equal(summary.schedules.length, COUNT);

for (const entry of summary.schedules) {
  assert.ok(Array.from(entry.task).length <= MAX_SUMMARY_TASK_CHARS);
  assert.ok(Buffer.byteLength(entry.task, 'utf8') <= MAX_SUMMARY_TASK_BYTES);
  assert.equal(entry.taskTruncated, true);
  assert.equal(Object.keys(entry).length, 8);
}

const serialized = JSON.stringify(summary);
const bytes = Buffer.byteLength(serialized, 'utf8');
assert.ok(bytes < 256 * 1024, `500-item summary unexpectedly large: ${bytes} bytes`);
for (const forbidden of [
  'owner-private-',
  'trace-private-',
  'provider-private-',
  'result-private-',
  'retryDelayMs',
  'ownerId',
  'traceId',
  'lastError',
  'result'
]) assert.equal(serialized.includes(forbidden), false, `volume summary leaked ${forbidden}`);

const emojiSummary = summarizeScheduleListOutput({
  ok: true,
  schedules: [{
    scheduleId: 'schedule_999',
    agentId: 'minimal-engineer',
    task: '🛰'.repeat(500),
    runAt: '2026-08-19T12:00:00.000Z',
    status: 'scheduled',
    attempts: 0,
    maxAttempts: 1
  }]
});
assert.equal(emojiSummary.schedules.length, 1);
assert.ok(Array.from(emojiSummary.schedules[0].task).length <= MAX_SUMMARY_TASK_CHARS);
assert.ok(Buffer.byteLength(emojiSummary.schedules[0].task, 'utf8') <= MAX_SUMMARY_TASK_BYTES);
assert.equal(emojiSummary.schedules[0].task.endsWith('…'), true);

const firstPage = boundScheduleListOutput(
  { ok: true, schedules: schedules.slice(0, 240) },
  { limit: 100, offset: 0, snapshot: null }
);
const firstSummary = summarizeScheduleListOutput(firstPage);
assert.equal(firstSummary.schedules.length, 100);
assert.equal(firstSummary.listMeta.total, 240);
assert.equal(firstSummary.listMeta.nextOffset, 100);
assert.match(firstSummary.listMeta.snapshot, /^[A-Za-z0-9_-]{43}$/);

const secondPage = boundScheduleListOutput(
  { ok: true, schedules: schedules.slice(0, 240) },
  { limit: 100, offset: 100, snapshot: firstSummary.listMeta.snapshot }
);
const secondSummary = summarizeScheduleListOutput(secondPage);
assert.equal(secondSummary.schedules.length, 100);
assert.equal(secondSummary.listMeta.offset, 100);
assert.equal(secondSummary.listMeta.nextOffset, 200);
assert.equal(secondSummary.listMeta.snapshot, firstSummary.listMeta.snapshot);

const ids = new Set([
  ...firstSummary.schedules.map((entry) => entry.scheduleId),
  ...secondSummary.schedules.map((entry) => entry.scheduleId)
]);
assert.equal(ids.size, 200, 'summary projection must not create page duplicates');

console.log(`schedule list summary volume tests passed (${bytes} bytes for ${COUNT} items)`);
