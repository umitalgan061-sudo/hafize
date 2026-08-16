import assert from 'node:assert/strict';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';

function makeStore() {
  const calls = { read: [], cancel: [], reschedule: [] };
  const entries = new Map([
    ['schedule_1', {
      scheduleId: 'schedule_1', ownerId: 'owner-a', traceId: 'trace-1', agentId: 'minimal-engineer',
      task: 'A', runAt: '2026-08-20T08:00:00.000Z', status: 'scheduled', attempts: 0,
      maxAttempts: 1, retryDelayMs: 60_000, lastError: null,
      createdAt: '2026-08-16T20:00:00.000Z', updatedAt: null
    }],
    ['schedule_2', {
      scheduleId: 'schedule_2', ownerId: 'owner-b', traceId: 'trace-2', agentId: 'minimal-engineer',
      task: 'B', runAt: '2026-08-20T09:00:00.000Z', status: 'scheduled', attempts: 0,
      maxAttempts: 1, retryDelayMs: 60_000, lastError: null,
      createdAt: '2026-08-16T20:00:00.000Z', updatedAt: null
    }],
    ['schedule_3', {
      scheduleId: 'schedule_3', ownerId: 'owner-a', traceId: 'trace-3', agentId: 'minimal-engineer',
      task: 'C', runAt: '2026-08-20T10:00:00.000Z', status: 'completed', attempts: 1,
      maxAttempts: 1, retryDelayMs: 60_000, lastError: null,
      createdAt: '2026-08-16T20:00:00.000Z', updatedAt: '2026-08-16T21:00:00.000Z'
    }]
  ]);
  return {
    calls,
    async add() { throw new Error('unused'); },
    async snapshot() { return { entries: [...entries.values()].map((entry) => ({ ...entry })) }; },
    async read(id) { calls.read.push(id); return entries.has(id) ? { ...entries.get(id) } : null; },
    async cancel(id) {
      calls.cancel.push(id);
      const entry = entries.get(id);
      entry.status = 'cancelled';
      entry.updatedAt = '2026-08-16T21:10:00.000Z';
      return { ...entry };
    },
    async reschedule(id, input) {
      calls.reschedule.push({ id, input: { ...input } });
      const entry = entries.get(id);
      if (input.runAt) entry.runAt = new Date(input.runAt).toISOString();
      if (input.retryDelayMs) entry.retryDelayMs = input.retryDelayMs;
      return { ...entry };
    }
  };
}

const store = makeStore();
const commands = createScheduleCommandBoundary({
  store,
  registry: { agents: [{ id: 'minimal-engineer' }] },
  createTraceId: () => 'trace-unused'
});
const alice = { authenticated: true, subject: 'owner-a' };

for (const scheduleId of [
  '',
  'schedule_0',
  'schedule_-1',
  'schedule_01',
  'SCHEDULE_1',
  'schedule_1/extra',
  ' schedule_1\n',
  `schedule_${'9'.repeat(121)}`,
  'not-a-schedule',
  null
]) {
  assert.deepEqual(
    await commands.cancel({ principal: alice, scheduleId }),
    { ok: false, error: 'INVALID_SCHEDULE_COMMAND' },
    `invalid schedule id must fail before lookup: ${String(scheduleId)}`
  );
}
assert.equal(store.calls.read.length, 0, 'malformed ids must not reach storage');
assert.equal(store.calls.cancel.length, 0);

const unsafeIntegerId = `schedule_${Number.MAX_SAFE_INTEGER + 1}`;
assert.deepEqual(
  await commands.cancel({ principal: alice, scheduleId: unsafeIntegerId }),
  { ok: false, error: 'INVALID_SCHEDULE_COMMAND' }
);
assert.equal(store.calls.read.length, 0);

assert.deepEqual(
  await commands.cancel({ principal: alice, scheduleId: 'schedule_999' }),
  { ok: false, error: 'SCHEDULE_NOT_FOUND' }
);
assert.deepEqual(store.calls.read, ['schedule_999']);

assert.deepEqual(
  await commands.cancel({ principal: alice, scheduleId: 'schedule_2' }),
  { ok: false, error: 'SCHEDULE_NOT_FOUND' },
  'cross-owner schedules must remain indistinguishable from missing schedules'
);
assert.deepEqual(store.calls.read, ['schedule_999', 'schedule_2']);
assert.equal(store.calls.cancel.length, 0);

assert.deepEqual(
  await commands.cancel({ principal: alice, scheduleId: 'schedule_3' }),
  { ok: false, error: 'SCHEDULE_NOT_CANCELLABLE' }
);
assert.equal(store.calls.cancel.length, 0);

const cancelled = await commands.cancel({ principal: alice, scheduleId: 'schedule_1' });
assert.equal(cancelled.ok, true);
assert.equal(cancelled.schedule.status, 'cancelled');
assert.deepEqual(store.calls.cancel, ['schedule_1']);

const store2 = makeStore();
const commands2 = createScheduleCommandBoundary({
  store: store2,
  registry: { agents: [{ id: 'minimal-engineer' }] },
  createTraceId: () => 'trace-unused'
});
assert.deepEqual(
  await commands2.reschedule({ principal: alice, scheduleId: 'bad', input: { runAt: '2026-08-21T08:00:00Z' } }),
  { ok: false, error: 'INVALID_SCHEDULE_COMMAND' }
);
assert.equal(store2.calls.read.length, 0);
assert.equal(store2.calls.reschedule.length, 0);

assert.deepEqual(
  await commands2.reschedule({ principal: alice, scheduleId: 'schedule_1', input: {} }),
  { ok: false, error: 'INVALID_SCHEDULE_COMMAND' }
);
assert.equal(store2.calls.read.length, 0, 'invalid timing must fail before ownership lookup');

const rescheduled = await commands2.reschedule({
  principal: alice,
  scheduleId: ' schedule_1 ',
  input: { runAt: '2026-08-21T08:00:00+03:00', retryDelayMs: 2_000 }
});
assert.equal(rescheduled.ok, true);
assert.deepEqual(store2.calls.reschedule, [{
  id: 'schedule_1',
  input: { runAt: '2026-08-21T08:00:00+03:00', retryDelayMs: 2_000 }
}]);

console.log('strict schedule id and ownership boundary tests passed');
