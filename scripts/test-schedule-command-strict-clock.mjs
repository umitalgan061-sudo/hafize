import assert from 'node:assert/strict';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

const principal = { authenticated: true, subject: 'clock-user' };
const agent = { id: 'minimal-engineer', name: 'Minimal Engineer' };
const fixedStoreNow = () => new Date('2026-08-18T07:30:00.000Z');

function makeCommands(now) {
  const store = createTaskScheduleStore({ now: fixedStoreNow });
  const commands = createScheduleCommandBoundary({
    store,
    registry: { agents: [agent] },
    now,
    createTraceId: () => 'trace_clock'
  });
  return { store, commands };
}

async function testInvalidClockFailsCreateClosed() {
  for (const now of [() => new Date('invalid'), () => { throw new Error('private clock failure'); }]) {
    const { store, commands } = makeCommands(now);
    const result = await commands.create({
      principal,
      input: {
        agentId: agent.id,
        task: 'Should not be created',
        runAt: '2026-08-18T07:31:00.000Z'
      }
    });
    assert.deepEqual(result, { ok: false, error: 'SCHEDULE_COMMAND_FAILED' });
    assert.equal(store.snapshot().entries.length, 0);
  }
}

async function testInvalidClockFailsRunAtRescheduleClosed() {
  const store = createTaskScheduleStore({ now: fixedStoreNow });
  const seed = store.add({
    ownerId: principal.subject,
    traceId: 'trace_seed',
    agentId: agent.id,
    task: 'Seed',
    runAt: '2026-08-18T08:00:00.000Z'
  });
  const commands = createScheduleCommandBoundary({
    store,
    registry: { agents: [agent] },
    now: () => new Date('invalid'),
    createTraceId: () => 'unused'
  });

  const result = await commands.reschedule({
    principal,
    scheduleId: seed.scheduleId,
    input: { runAt: '2026-08-18T09:00:00.000Z' }
  });
  assert.deepEqual(result, { ok: false, error: 'SCHEDULE_COMMAND_FAILED' });
  assert.equal(store.read(seed.scheduleId).runAt, '2026-08-18T08:00:00.000Z');
}

async function testRetryOnlyRescheduleDoesNotDependOnWallClock() {
  const store = createTaskScheduleStore({ now: fixedStoreNow });
  const seed = store.add({
    ownerId: principal.subject,
    traceId: 'trace_retry_only',
    agentId: agent.id,
    task: 'Retry only',
    runAt: '2026-08-18T08:00:00.000Z'
  });
  const commands = createScheduleCommandBoundary({
    store,
    registry: { agents: [agent] },
    now: () => { throw new Error('clock should not be read'); },
    createTraceId: () => 'unused'
  });

  const result = await commands.reschedule({
    principal,
    scheduleId: seed.scheduleId,
    input: { retryDelayMs: 15_000 }
  });
  assert.equal(result.ok, true);
  assert.equal(result.schedule.retryDelayMs, 15_000);
  assert.equal(result.schedule.runAt, '2026-08-18T08:00:00.000Z');
}

async function testFactoryRejectsInvalidClockDependency() {
  const store = createTaskScheduleStore({ now: fixedStoreNow });
  assert.throws(
    () => createScheduleCommandBoundary({
      store,
      registry: { agents: [agent] },
      createTraceId: () => 'trace',
      now: 123
    }),
    /INVALID_SCHEDULE_COMMAND_BOUNDARY:now/
  );
}

await testInvalidClockFailsCreateClosed();
await testInvalidClockFailsRunAtRescheduleClosed();
await testRetryOnlyRescheduleDoesNotDependOnWallClock();
await testFactoryRejectsInvalidClockDependency();
console.log('schedule command strict-clock tests passed');
