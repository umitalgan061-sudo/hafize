import assert from 'node:assert/strict';
import { createBearerPrincipalAuthenticator } from '../lib/server-auth.mjs';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';
import { createScheduleWorker } from '../lib/schedule-worker.mjs';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

const now = () => new Date('2026-08-15T08:00:00.000Z');
const registry = { agents: [{ id: 'minimal-engineer', name: 'Minimal Engineer' }] };

const unbounded = createTaskScheduleStore({ now });
for (let index = 0; index < 160; index += 1) {
  unbounded.add({
    traceId: `trace-${index}`,
    agentId: 'minimal-engineer',
    task: `Task ${index}`,
    runAt: '2026-08-15T07:59:00.000Z'
  });
}
assert.equal(unbounded.snapshot().entries.length, 160);
assert.equal(unbounded.claimDue().length, 160, 'default claim must not impose an application ceiling');

const parallelStore = createTaskScheduleStore({ now });
for (let index = 0; index < 32; index += 1) {
  parallelStore.add({
    traceId: `parallel-${index}`,
    agentId: 'minimal-engineer',
    task: `Parallel ${index}`,
    runAt: '2026-08-15T07:59:00.000Z'
  });
}
let active = 0;
let peak = 0;
let started = 0;
let release;
const gate = new Promise((resolve) => { release = resolve; });
const worker = createScheduleWorker({
  store: parallelStore,
  registry,
  now,
  async executeAgentTask() {
    active += 1;
    started += 1;
    peak = Math.max(peak, active);
    if (started === 32) release();
    await gate;
    active -= 1;
    return { ok: true };
  }
});
const parallelResult = await worker.runDue();
assert.equal(parallelResult.claimed, 32);
assert.equal(peak, 32, 'all due schedules should be allowed to execute concurrently');
assert.equal(parallelStore.snapshot().entries.every((entry) => entry.status === 'completed'), true);

const commandStore = createTaskScheduleStore({ now });
let traceNo = 0;
const commands = createScheduleCommandBoundary({
  store: commandStore,
  registry,
  createTraceId: () => `owner-trace-${++traceNo}`
});
const alice = { authenticated: true, subject: 'alice' };
const bob = { authenticated: true, subject: 'bob' };
const created = await commands.create({
  principal: alice,
  input: {
    agentId: 'minimal-engineer',
    task: 'Run when I decide.',
    runAt: '2026-08-15T12:00:00+03:00'
  }
});
assert.equal(created.ok, true);
assert.equal(created.schedule.runAt, '2026-08-15T09:00:00.000Z');
assert.deepEqual(
  await commands.reschedule({
    principal: bob,
    scheduleId: created.schedule.scheduleId,
    input: { runAt: '2026-08-15T13:00:00+03:00' }
  }),
  { ok: false, error: 'SCHEDULE_NOT_FOUND' }
);
const moved = await commands.reschedule({
  principal: alice,
  scheduleId: created.schedule.scheduleId,
  input: { runAt: '2026-08-15T14:30:00+03:00' }
});
assert.equal(moved.ok, true);
assert.equal(moved.schedule.runAt, '2026-08-15T11:30:00.000Z');
assert.deepEqual(
  await commands.reschedule({ principal: alice, scheduleId: moved.schedule.scheduleId, input: { runAt: 'bad-date' } }),
  { ok: false, error: 'INVALID_SCHEDULE_COMMAND' }
);

const token = 'z'.repeat(48);
const http = createScheduleHttpApi({
  authenticator: createBearerPrincipalAuthenticator({ token, subject: 'alice' }),
  commands,
  readJson: async (request) => request.body
});
const patched = await http.handle({
  request: { body: { runAt: '2026-08-15T16:00:00+03:00' } },
  method: 'PATCH',
  pathname: `/api/schedules/${moved.schedule.scheduleId}`,
  headers: { authorization: `Bearer ${token}` }
});
assert.equal(patched.status, 200);
assert.equal(patched.body.schedule.runAt, '2026-08-15T13:00:00.000Z');

commandStore.claimDue({ limit: 1 });
const runningPatch = await http.handle({
  request: { body: { runAt: '2026-08-16T10:00:00+03:00' } },
  method: 'PATCH',
  pathname: `/api/schedules/${moved.schedule.scheduleId}`,
  headers: { authorization: `Bearer ${token}` }
});
assert.equal(runningPatch.status, 409);
assert.equal(runningPatch.body.error, 'SCHEDULE_NOT_RESCHEDULABLE');

console.log('unbounded user schedule tests passed');
