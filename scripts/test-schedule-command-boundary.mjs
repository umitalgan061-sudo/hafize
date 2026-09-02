import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';

const now = () => new Date('2026-08-12T11:00:00.000Z');
const store = createTaskScheduleStore({ now });
const registry = {
  agents: [
    { id: 'hafize-general', name: 'Hafize' },
    { id: 'agency-code-reviewer', name: 'Code Reviewer' }
  ]
};
let traceNo = 0;
const commands = createScheduleCommandBoundary({
  store,
  registry,
  createTraceId: () => `trace-server-${++traceNo}`
});
const alice = { authenticated: true, subject: 'user-alice' };
const bob = { authenticated: true, subject: 'user-bob' };

assert.deepEqual(await commands.create(), { ok: false, error: 'AUTH_REQUIRED' });
assert.deepEqual(
  await commands.list({ principal: { authenticated: false, subject: 'user-alice' } }),
  { ok: false, error: 'AUTH_REQUIRED' }
);
assert.deepEqual(
  await commands.cancel({ principal: { authenticated: true, subject: ' ' }, scheduleId: 'schedule_1' }),
  { ok: false, error: 'AUTH_REQUIRED' }
);

assert.deepEqual(
  await commands.create({
    principal: alice,
    input: {
      agentId: 'hafize-general',
      task: 'Sabah özetini hazırla.',
      runAt: '2026-08-13T06:00:00.000Z',
      token: 'must-not-be-accepted'
    }
  }),
  { ok: false, error: 'INVALID_SCHEDULE_COMMAND' }
);
assert.equal(store.snapshot().entries.length, 0);

assert.deepEqual(
  await commands.create({
    principal: alice,
    input: {
      agentId: 'missing-agent',
      task: 'Çalışmamalı.',
      runAt: '2026-08-13T06:00:00.000Z'
    }
  }),
  { ok: false, error: 'INVALID_AGENT' }
);

const created = await commands.create({
  principal: alice,
  input: {
    agentId: 'hafize-general',
    task: 'Sabah özetini hazırla.',
    runAt: '2026-08-13T06:00:00.000Z',
    maxAttempts: 2
  }
});
assert.equal(created.ok, true);
assert.equal(created.schedule.traceId, 'trace-server-1');
assert.equal('ownerId' in created.schedule, false);
assert.equal(store.read(created.schedule.scheduleId).ownerId, 'user-alice');

const bobCreated = await commands.create({
  principal: bob,
  input: {
    agentId: 'agency-code-reviewer',
    task: 'Repo özetini çıkar.',
    runAt: '2026-08-13T07:00:00.000Z'
  }
});
assert.equal(bobCreated.ok, true);

store.add({
  traceId: 'trace-internal',
  agentId: 'hafize-general',
  task: 'Internal task',
  runAt: '2026-08-13T08:00:00.000Z'
});

const aliceList = await commands.list({ principal: alice });
assert.equal(aliceList.ok, true);
assert.deepEqual(aliceList.schedules.map((entry) => entry.scheduleId), [created.schedule.scheduleId]);
assert.equal(aliceList.schedules.some((entry) => 'ownerId' in entry), false);

const bobList = await commands.list({ principal: bob });
assert.deepEqual(bobList.schedules.map((entry) => entry.scheduleId), [bobCreated.schedule.scheduleId]);

assert.deepEqual(
  await commands.cancel({ principal: bob, scheduleId: created.schedule.scheduleId }),
  { ok: false, error: 'SCHEDULE_NOT_FOUND' }
);
assert.equal(store.read(created.schedule.scheduleId).status, 'scheduled');

const cancelled = await commands.cancel({ principal: alice, scheduleId: created.schedule.scheduleId });
assert.equal(cancelled.ok, true);
assert.equal(cancelled.schedule.status, 'cancelled');
assert.equal(store.read(created.schedule.scheduleId).status, 'cancelled');
assert.deepEqual(
  await commands.cancel({ principal: alice, scheduleId: created.schedule.scheduleId }),
  { ok: false, error: 'SCHEDULE_NOT_CANCELLABLE' }
);

const tinyStore = createTaskScheduleStore({ maxEntries: 1, now });
const tiny = createScheduleCommandBoundary({ store: tinyStore, registry, createTraceId: () => 'trace-tiny' });
assert.equal(
  (await tiny.create({
    principal: alice,
    input: { agentId: 'hafize-general', task: '1', runAt: '2026-08-13T00:00:00Z' }
  })).ok,
  true
);
assert.deepEqual(
  await tiny.create({
    principal: alice,
    input: { agentId: 'hafize-general', task: '2', runAt: '2026-08-13T01:00:00Z' }
  }),
  { ok: false, error: 'SCHEDULE_CAPACITY_REACHED' }
);

// Promise tabanlı persistence store sözleşmesi de aynı authorization boundary üzerinden çalışmalı.
const asyncEntries = [];
let asyncNextId = 1;
const asyncStore = {
  async add(input) {
    const entry = {
      scheduleId: `schedule_${asyncNextId++}`,
      ...input,
      status: 'scheduled',
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 1,
      lastError: null,
      createdAt: '2026-08-12T11:00:00.000Z',
      updatedAt: null
    };
    asyncEntries.push(entry);
    return { ...entry };
  },
  async read(scheduleId) {
    const entry = asyncEntries.find((item) => item.scheduleId === scheduleId);
    return entry ? { ...entry } : null;
  },
  async snapshot() {
    return { entries: asyncEntries.map((entry) => ({ ...entry })) };
  },
  async cancel(scheduleId) {
    const entry = asyncEntries.find((item) => item.scheduleId === scheduleId);
    if (!entry) throw new Error('TASK_SCHEDULE_NOT_FOUND');
    entry.status = 'cancelled';
    entry.updatedAt = '2026-08-12T11:01:00.000Z';
    return { ...entry };
  }
};
const asyncCommands = createScheduleCommandBoundary({
  store: asyncStore,
  registry,
  createTraceId: () => 'trace-async'
});
const asyncCreated = await asyncCommands.create({
  principal: alice,
  input: {
    agentId: 'hafize-general',
    task: 'Persisted schedule.',
    runAt: '2026-08-13T09:00:00.000Z'
  }
});
assert.equal(asyncCreated.ok, true);
assert.equal(asyncCreated.schedule.traceId, 'trace-async');
assert.equal((await asyncStore.read(asyncCreated.schedule.scheduleId)).ownerId, 'user-alice');
assert.deepEqual(
  (await asyncCommands.list({ principal: alice })).schedules.map((entry) => entry.scheduleId),
  [asyncCreated.schedule.scheduleId]
);
assert.equal(
  (await asyncCommands.cancel({ principal: alice, scheduleId: asyncCreated.schedule.scheduleId })).schedule.status,
  'cancelled'
);

const failingAsyncStore = {
  add: async () => { throw new Error('provider secret detail'); },
  read: async () => { throw new Error('provider secret detail'); },
  snapshot: async () => { throw new Error('provider secret detail'); },
  cancel: async () => { throw new Error('provider secret detail'); }
};
const failing = createScheduleCommandBoundary({
  store: failingAsyncStore,
  registry,
  createTraceId: () => 'trace-failing'
});
assert.deepEqual(
  await failing.create({
    principal: alice,
    input: { agentId: 'hafize-general', task: 'x', runAt: '2026-08-13T09:00:00.000Z' }
  }),
  { ok: false, error: 'SCHEDULE_COMMAND_FAILED' }
);
assert.deepEqual(await failing.list({ principal: alice }), { ok: false, error: 'SCHEDULE_COMMAND_FAILED' });
assert.deepEqual(
  await failing.cancel({ principal: alice, scheduleId: 'schedule_1' }),
  { ok: false, error: 'SCHEDULE_COMMAND_FAILED' }
);

// Eksik veya nesne olmayan istek AUTH_REQUIRED ile fail-closed döner, ham TypeError atmaz.
for (const request of [undefined, null, [], 'alice']) {
  for (const command of ['create', 'list', 'cancel']) {
    assert.deepEqual(await commands[command](request), { ok: false, error: 'AUTH_REQUIRED' });
  }
}

console.log('schedule command boundary tests passed');
