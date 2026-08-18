import assert from 'node:assert/strict';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

const NOW = new Date('2026-08-18T07:30:00.000Z');
const principal = { authenticated: true, subject: 'adversarial-user' };
const agent = { id: 'minimal-engineer', name: 'Minimal Engineer' };

function build() {
  const store = createTaskScheduleStore({ now: () => new Date(NOW) });
  let traceCalls = 0;
  const commands = createScheduleCommandBoundary({
    store,
    registry: { agents: [agent] },
    now: () => new Date(NOW),
    createTraceId: () => `trace_adv_${++traceCalls}`
  });
  return { store, commands, traceCalls: () => traceCalls };
}

const invalidRunAtValues = [
  '2026-08-18',
  '2026-08-18T07:31:00',
  '2026-08-18 07:31:00Z',
  'not-a-date',
  '',
  123,
  null,
  '2026-08-18T07:31:00.000Z\nnext'
];

for (const runAt of invalidRunAtValues) {
  const { store, commands, traceCalls } = build();
  const result = await commands.create({
    principal,
    input: { agentId: agent.id, task: 'Invalid time', runAt }
  });
  assert.deepEqual(result, { ok: false, error: 'INVALID_SCHEDULE_COMMAND' });
  assert.equal(traceCalls(), 0);
  assert.equal(store.snapshot().entries.length, 0);
}

for (const input of [
  { agentId: agent.id, task: 'Unknown field', runAt: '2026-08-18T07:31:00.000Z', extra: true },
  { agentId: agent.id, task: 'Missing runAt' },
  { agentId: agent.id, task: 'Bad retry', runAt: '2026-08-18T07:31:00.000Z', retryDelayMs: 999 },
  { agentId: agent.id, task: 'Bad retry type', runAt: '2026-08-18T07:31:00.000Z', retryDelayMs: '60000' }
]) {
  const { store, commands, traceCalls } = build();
  const result = await commands.create({ principal, input });
  assert.deepEqual(result, { ok: false, error: 'INVALID_SCHEDULE_COMMAND' });
  assert.equal(traceCalls(), 0);
  assert.equal(store.snapshot().entries.length, 0);
}

{
  const { commands } = build();
  const exactTask = 'x'.repeat(20_000);
  const minAttempts = await commands.create({
    principal,
    input: { agentId: agent.id, task: exactTask, runAt: '2026-08-18T07:31:00.000Z', maxAttempts: 1 }
  });
  assert.equal(minAttempts.ok, true);
  assert.equal(minAttempts.schedule.task.length, 20_000);
  assert.equal(minAttempts.schedule.maxAttempts, 1);
}

{
  const { commands } = build();
  const maxAttempts = await commands.create({
    principal,
    input: { agentId: agent.id, task: 'Upper attempts boundary', runAt: '2026-08-18T07:31:00.000Z', maxAttempts: 5 }
  });
  assert.equal(maxAttempts.ok, true);
  assert.equal(maxAttempts.schedule.maxAttempts, 5);
}

{
  const { store, commands } = build();
  const created = await commands.create({
    principal,
    input: { agentId: agent.id, task: 'Patch target', runAt: '2026-08-18T08:00:00.000Z' }
  });
  const before = store.read(created.schedule.scheduleId);
  for (const input of [
    { runAt: '2026-08-18T08:30:00.000Z', extra: true },
    {},
    { retryDelayMs: 86_400_001 },
    { retryDelayMs: 1500.5 }
  ]) {
    const result = await commands.reschedule({ principal, scheduleId: created.schedule.scheduleId, input });
    assert.deepEqual(result, { ok: false, error: 'INVALID_SCHEDULE_COMMAND' });
    assert.deepEqual(store.read(created.schedule.scheduleId), before);
  }
}

console.log('schedule command strict adversarial tests passed');
