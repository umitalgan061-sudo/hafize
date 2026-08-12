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

assert.deepEqual(commands.create(), { ok: false, error: 'AUTH_REQUIRED' });
assert.deepEqual(commands.list({ principal: { authenticated: false, subject: 'user-alice' } }), { ok: false, error: 'AUTH_REQUIRED' });
assert.deepEqual(commands.cancel({ principal: { authenticated: true, subject: ' ' }, scheduleId: 'schedule_1' }), { ok: false, error: 'AUTH_REQUIRED' });

assert.deepEqual(
  commands.create({
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
  commands.create({
    principal: alice,
    input: {
      agentId: 'missing-agent',
      task: 'Çalışmamalı.',
      runAt: '2026-08-13T06:00:00.000Z'
    }
  }),
  { ok: false, error: 'INVALID_AGENT' }
);

const created = commands.create({
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

const bobCreated = commands.create({
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

const aliceList = commands.list({ principal: alice });
assert.equal(aliceList.ok, true);
assert.deepEqual(aliceList.schedules.map((entry) => entry.scheduleId), [created.schedule.scheduleId]);
assert.equal(aliceList.schedules.some((entry) => 'ownerId' in entry), false);

const bobList = commands.list({ principal: bob });
assert.deepEqual(bobList.schedules.map((entry) => entry.scheduleId), [bobCreated.schedule.scheduleId]);

assert.deepEqual(
  commands.cancel({ principal: bob, scheduleId: created.schedule.scheduleId }),
  { ok: false, error: 'SCHEDULE_NOT_FOUND' }
);
assert.equal(store.read(created.schedule.scheduleId).status, 'scheduled');

const cancelled = commands.cancel({ principal: alice, scheduleId: created.schedule.scheduleId });
assert.equal(cancelled.ok, true);
assert.equal(cancelled.schedule.status, 'cancelled');
assert.equal(store.read(created.schedule.scheduleId).status, 'cancelled');
assert.deepEqual(
  commands.cancel({ principal: alice, scheduleId: created.schedule.scheduleId }),
  { ok: false, error: 'SCHEDULE_NOT_CANCELLABLE' }
);

const tinyStore = createTaskScheduleStore({ maxEntries: 1, now });
const tiny = createScheduleCommandBoundary({ store: tinyStore, registry, createTraceId: () => 'trace-tiny' });
assert.equal(tiny.create({ principal: alice, input: { agentId: 'hafize-general', task: '1', runAt: '2026-08-13T00:00:00Z' } }).ok, true);
assert.deepEqual(
  tiny.create({ principal: alice, input: { agentId: 'hafize-general', task: '2', runAt: '2026-08-13T01:00:00Z' } }),
  { ok: false, error: 'SCHEDULE_CAPACITY_REACHED' }
);

console.log('schedule command boundary tests passed');
