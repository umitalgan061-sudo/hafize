import assert from 'node:assert/strict';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

const NOW = new Date('2026-08-18T07:30:00.000Z');
const principal = { authenticated: true, subject: 'user-1' };
const agent = { id: 'minimal-engineer', name: 'Minimal Engineer' };

function fixture({ now = () => new Date(NOW), storeNow = () => new Date(NOW) } = {}) {
  const store = createTaskScheduleStore({ now: storeNow });
  let traceCalls = 0;
  const commands = createScheduleCommandBoundary({
    store,
    registry: { agents: [agent] },
    now,
    createTraceId: () => `trace_${++traceCalls}`
  });
  return { store, commands, traceCalls: () => traceCalls };
}

async function testValidFutureCreate() {
  const { store, commands, traceCalls } = fixture();
  const result = await commands.create({
    principal,
    input: {
      agentId: agent.id,
      task: '  Run a future task.  ',
      runAt: '2026-08-18T07:31:00.000Z',
      maxAttempts: 5,
      retryDelayMs: 5000
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.schedule.task, 'Run a future task.');
  assert.equal(result.schedule.maxAttempts, 5);
  assert.equal(result.schedule.retryDelayMs, 5000);
  assert.equal(traceCalls(), 1);
  assert.equal(store.snapshot().entries.length, 1);
}

async function testPastAndEqualCreateFailBeforeTrace() {
  for (const runAt of ['2026-08-18T07:29:59.999Z', '2026-08-18T07:30:00.000Z']) {
    const { store, commands, traceCalls } = fixture();
    const result = await commands.create({
      principal,
      input: { agentId: agent.id, task: 'Past task', runAt }
    });
    assert.deepEqual(result, { ok: false, error: 'INVALID_SCHEDULE_COMMAND' });
    assert.equal(traceCalls(), 0);
    assert.equal(store.snapshot().entries.length, 0);
  }
}

async function testMaxAttemptsIsStrictNotClamped() {
  for (const value of [0, 6, -1, 1.5, '2', null, Number.MAX_SAFE_INTEGER]) {
    const { store, commands, traceCalls } = fixture();
    const result = await commands.create({
      principal,
      input: {
        agentId: agent.id,
        task: 'Strict attempts',
        runAt: '2026-08-18T07:31:00.000Z',
        maxAttempts: value
      }
    });
    assert.deepEqual(result, { ok: false, error: 'INVALID_SCHEDULE_COMMAND' }, `value=${String(value)}`);
    assert.equal(traceCalls(), 0);
    assert.equal(store.snapshot().entries.length, 0);
  }

  const { commands } = fixture();
  const defaulted = await commands.create({
    principal,
    input: { agentId: agent.id, task: 'Default attempts', runAt: '2026-08-18T07:31:00.000Z' }
  });
  assert.equal(defaulted.ok, true);
  assert.equal(defaulted.schedule.maxAttempts, 1);
}

async function testTaskIsValidatedBeforeTrace() {
  for (const task of ['', '   ', 'x'.repeat(20_001), 42, null]) {
    const { store, commands, traceCalls } = fixture();
    const result = await commands.create({
      principal,
      input: { agentId: agent.id, task, runAt: '2026-08-18T07:31:00.000Z' }
    });
    assert.deepEqual(result, { ok: false, error: 'INVALID_SCHEDULE_COMMAND' });
    assert.equal(traceCalls(), 0);
    assert.equal(store.snapshot().entries.length, 0);
  }
}

async function testPastRescheduleDoesNotMutate() {
  const { store, commands } = fixture();
  const created = await commands.create({
    principal,
    input: { agentId: agent.id, task: 'Keep future time', runAt: '2026-08-18T08:00:00.000Z' }
  });
  assert.equal(created.ok, true);
  const before = store.read(created.schedule.scheduleId);

  const result = await commands.reschedule({
    principal,
    scheduleId: created.schedule.scheduleId,
    input: { runAt: '2026-08-18T07:00:00.000Z' }
  });
  assert.deepEqual(result, { ok: false, error: 'INVALID_SCHEDULE_COMMAND' });
  assert.deepEqual(store.read(created.schedule.scheduleId), before);
}

async function testOffsetFutureIsAccepted() {
  const { commands } = fixture();
  const result = await commands.create({
    principal,
    input: {
      agentId: agent.id,
      task: 'Offset time',
      runAt: '2026-08-18T10:31:00+03:00',
      maxAttempts: 1
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.schedule.runAt, '2026-08-18T07:31:00.000Z');
}

await testValidFutureCreate();
await testPastAndEqualCreateFailBeforeTrace();
await testMaxAttemptsIsStrictNotClamped();
await testTaskIsValidatedBeforeTrace();
await testPastRescheduleDoesNotMutate();
await testOffsetFutureIsAccepted();
console.log('schedule command strict-input tests passed');
