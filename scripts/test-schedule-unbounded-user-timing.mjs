import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';
import { createTaskSchedulePersistence } from '../lib/task-schedule-persistence.mjs';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';
import { createScheduleWorker } from '../lib/schedule-worker.mjs';

let clock = new Date('2026-08-15T08:00:00.000Z');
const now = () => new Date(clock);
const registry = { agents: [{ id: 'minimal-engineer', name: 'Minimal Engineer' }] };

// No default task-count or claim-batch cap: exceed the former 128/16 limits.
const store = createTaskScheduleStore({ now });
for (let index = 0; index < 160; index += 1) {
  store.add({
    ownerId: 'user-1',
    traceId: `trace-${index}`,
    agentId: 'minimal-engineer',
    task: `Task ${index}`,
    runAt: index < 40 ? '2026-08-15T08:00:00.000Z' : '2026-08-16T08:00:00.000Z'
  });
}
assert.equal(store.snapshot().entries.length, 160);
const claimed = store.claimDue();
assert.equal(claimed.length, 40);
assert.equal(store.snapshot().entries.filter((entry) => entry.status === 'scheduled').length, 120);
for (const item of claimed) store.complete(item.scheduleId);

// Explicit operator limits remain optional backpressure, without a hard-coded maximum.
const limited = createTaskScheduleStore({ maxEntries: 1500, now });
for (let index = 0; index < 1100; index += 1) {
  limited.add({ traceId: `large-${index}`, agentId: 'minimal-engineer', task: 'x', runAt: clock });
}
assert.equal(limited.snapshot().entries.length, 1100);
assert.throws(() => createTaskScheduleStore({ maxEntries: 0, now }), /INVALID_TASK_SCHEDULE:maxEntries/);

// User timing is exact and owner-scoped, including retry timing.
const timingStore = createTaskScheduleStore({ now });
const commands = createScheduleCommandBoundary({
  store: timingStore,
  registry,
  createTraceId: () => 'trace-owned'
});
const alice = { authenticated: true, subject: 'alice' };
const bob = { authenticated: true, subject: 'bob' };
const created = await commands.create({
  principal: alice,
  input: {
    agentId: 'minimal-engineer',
    task: 'User chooses this time.',
    runAt: '2026-08-15T12:30:00+03:00',
    maxAttempts: 3,
    retryDelayMs: 7_000
  }
});
assert.equal(created.ok, true);
assert.equal(created.schedule.runAt, '2026-08-15T09:30:00.000Z');
assert.equal(created.schedule.retryDelayMs, 7_000);
assert.equal('ownerId' in created.schedule, false);
assert.deepEqual(
  await commands.reschedule({ principal: bob, scheduleId: created.schedule.scheduleId, input: { runAt: '2026-08-15T10:00:00Z' } }),
  { ok: false, error: 'SCHEDULE_NOT_FOUND' }
);
const moved = await commands.reschedule({
  principal: alice,
  scheduleId: created.schedule.scheduleId,
  input: { runAt: '2026-08-15T13:00:00+03:00', retryDelayMs: 11_000 }
});
assert.equal(moved.ok, true);
assert.equal(moved.schedule.runAt, '2026-08-15T10:00:00.000Z');
assert.equal(moved.schedule.retryDelayMs, 11_000);
assert.deepEqual(
  await commands.reschedule({ principal: alice, scheduleId: created.schedule.scheduleId, input: { runAt: '2026-08-15 13:00' } }),
  { ok: false, error: 'INVALID_SCHEDULE_COMMAND' }
);

// HTTP PATCH exposes only authenticated owner-controlled timing changes.
const api = createScheduleHttpApi({
  authenticator: { authenticate: () => ({ ok: true, principal: alice }) },
  commands,
  readJson: async (request) => request.body
});
const patched = await api.handle({
  method: 'PATCH',
  pathname: `/api/schedules/${created.schedule.scheduleId}`,
  headers: {},
  request: { body: { retryDelayMs: 12_000 } }
});
assert.equal(patched.status, 200);
assert.equal(patched.body.schedule.retryDelayMs, 12_000);
assert.equal((await api.handle({ method: 'PUT', pathname: `/api/schedules/${created.schedule.scheduleId}`, headers: {} })).headers.Allow, 'PATCH, DELETE');

// Durable reschedule persists and old snapshots without retryDelayMs remain loadable.
let envelope = {
  schemaVersion: 1,
  snapshot: {
    entries: [{
      scheduleId: 'schedule_1', traceId: 'legacy', ownerId: 'alice', agentId: 'minimal-engineer', task: 'legacy',
      runAt: '2026-08-16T08:00:00.000Z', status: 'scheduled', attempts: 0, maxAttempts: 1, lastError: null,
      createdAt: '2026-08-15T08:00:00.000Z', updatedAt: null
    }]
  }
};
const persistence = createTaskSchedulePersistence({
  adapter: {
    load: async () => structuredClone(envelope),
    save: async (next) => { envelope = structuredClone(next); }
  },
  storeOptions: { now }
});
await persistence.open();
assert.equal(persistence.read('schedule_1').retryDelayMs, 60_000);
await persistence.reschedule('schedule_1', { runAt: '2026-08-17T08:00:00.000Z', retryDelayMs: 9_000 });
assert.equal(envelope.snapshot.entries[0].retryDelayMs, 9_000);
assert.equal(envelope.snapshot.entries[0].runAt, '2026-08-17T08:00:00.000Z');

// All due tasks begin concurrently: none may resolve before all starts were observed.
const parallelStore = createTaskScheduleStore({ now });
for (let index = 0; index < 32; index += 1) {
  parallelStore.add({
    traceId: `parallel-${index}`, agentId: 'minimal-engineer', task: `parallel ${index}`,
    runAt: '2026-08-15T08:00:00.000Z'
  });
}
let starts = 0;
let release;
const gate = new Promise((resolve) => { release = resolve; });
const worker = createScheduleWorker({
  store: parallelStore,
  registry,
  now,
  async executeAgentTask() {
    starts += 1;
    await gate;
    return { ok: true };
  }
});
const running = worker.runDue();
for (let turn = 0; turn < 20 && starts < 32; turn += 1) await new Promise((resolve) => setImmediate(resolve));
assert.equal(starts, 32, 'all due tasks must be launched without the old maxBatch/16 cap');
release();
const result = await running;
assert.equal(result.claimed, 32);
assert.equal(result.results.every((entry) => entry.ok), true);

// Per-task retry delay is used rather than a hidden worker-wide 60 second decision.
const retryStore = createTaskScheduleStore({ now });
const retryTask = retryStore.add({
  traceId: 'retry-owned', agentId: 'minimal-engineer', task: 'retry', runAt: clock,
  maxAttempts: 2, retryDelayMs: 13_000
});
const retryWorker = createScheduleWorker({
  store: retryStore, registry, now,
  executeAgentTask: async () => ({ ok: false, error: 'TEMPORARY_FAILURE' })
});
await retryWorker.runDue();
assert.equal(retryStore.read(retryTask.scheduleId).runAt, '2026-08-15T08:00:13.000Z');

console.log('unbounded schedule concurrency and user timing tests passed');
