import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';
import { createTaskSchedulePersistence } from '../lib/task-schedule-persistence.mjs';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';
import { createScheduleWorker } from '../lib/schedule-worker.mjs';

const now = () => new Date('2026-08-15T10:00:00.000Z');
const registry = { agents: [{ id: 'minimal-engineer', name: 'Minimal Engineer' }] };
const principal = { authenticated: true, subject: 'owner-1' };

// Durable claim happens once before parallel external execution, while completion saves serialize.
let envelope = null;
let savesInFlight = 0;
let maxSavesInFlight = 0;
const persistence = createTaskSchedulePersistence({
  adapter: {
    load: async () => envelope && structuredClone(envelope),
    async save(next) {
      savesInFlight += 1;
      maxSavesInFlight = Math.max(maxSavesInFlight, savesInFlight);
      await new Promise((resolve) => setImmediate(resolve));
      envelope = structuredClone(next);
      savesInFlight -= 1;
    }
  },
  storeOptions: { now }
});
await persistence.open();
for (let index = 0; index < 24; index += 1) {
  await persistence.add({
    ownerId: 'owner-1', traceId: `durable-${index}`, agentId: 'minimal-engineer', task: `D${index}`,
    runAt: '2026-08-15T10:00:00.000Z'
  });
}
let starts = 0;
let release;
const gate = new Promise((resolve) => { release = resolve; });
const worker = createScheduleWorker({
  store: persistence,
  registry,
  now,
  async executeAgentTask() {
    starts += 1;
    await gate;
    return { ok: true };
  }
});
const run = worker.runDue();
for (let turn = 0; turn < 30 && starts < 24; turn += 1) await new Promise((resolve) => setImmediate(resolve));
assert.equal(starts, 24);
assert.equal(persistence.snapshot().entries.every((entry) => entry.status === 'running'), true);
assert.equal(envelope.snapshot.entries.every((entry) => entry.status === 'running'), true);
release();
const finished = await run;
assert.equal(finished.claimed, 24);
assert.equal(persistence.snapshot().entries.every((entry) => entry.status === 'completed'), true);
assert.equal(envelope.snapshot.entries.every((entry) => entry.status === 'completed'), true);
assert.equal(maxSavesInFlight, 1, 'durable mutations must remain serialized while task execution is parallel');

// Explicit backpressure remains caller-selected and is not clamped to the former 16 ceiling.
const bounded = createTaskScheduleStore({ now });
for (let index = 0; index < 50; index += 1) {
  bounded.add({ traceId: `bounded-${index}`, agentId: 'minimal-engineer', task: 'x', runAt: now() });
}
const boundedWorker = createScheduleWorker({
  store: bounded,
  registry,
  now,
  maxBatch: 25,
  executeAgentTask: async () => ({ ok: true })
});
assert.equal((await boundedWorker.runDue()).claimed, 25);
assert.equal(bounded.snapshot().entries.filter((entry) => entry.status === 'scheduled').length, 25);
assert.equal((await boundedWorker.runDue({ limit: 20 })).claimed, 20);
assert.equal(bounded.snapshot().entries.filter((entry) => entry.status === 'scheduled').length, 5);
assert.throws(
  () => createScheduleWorker({ store: bounded, registry, now, maxBatch: 0, executeAgentTask: async () => ({ ok: true }) }),
  /INVALID_SCHEDULE_WORKER:maxBatch/
);

// Reschedule cannot race a task back out of running after the worker has claimed it.
const raceStore = createTaskScheduleStore({ now });
const race = raceStore.add({
  ownerId: 'owner-1', traceId: 'race', agentId: 'minimal-engineer', task: 'race', runAt: now()
});
raceStore.claimDue();
assert.throws(
  () => raceStore.reschedule(race.scheduleId, { runAt: '2026-08-15T11:00:00Z' }),
  /TASK_SCHEDULE_NOT_RESCHEDULABLE/
);
assert.equal(raceStore.read(race.scheduleId).status, 'running');
assert.equal(raceStore.read(race.scheduleId).runAt, '2026-08-15T10:00:00.000Z');

// Command boundary maps the same state safely and never reveals another owner's existence.
const commandStore = createTaskScheduleStore({ now });
const commands = createScheduleCommandBoundary({
  store: commandStore,
  registry,
  createTraceId: () => 'trace-command'
});
const commandCreated = await commands.create({
  principal,
  input: { agentId: 'minimal-engineer', task: 'command', runAt: '2026-08-15T11:00:00+01:00' }
});
commandStore.claimDue();
assert.deepEqual(
  await commands.reschedule({ principal, scheduleId: commandCreated.schedule.scheduleId, input: { runAt: '2026-08-15T12:00:00Z' } }),
  { ok: false, error: 'SCHEDULE_NOT_RESCHEDULABLE' }
);
assert.deepEqual(
  await commands.reschedule({
    principal: { authenticated: true, subject: 'owner-2' },
    scheduleId: commandCreated.schedule.scheduleId,
    input: { retryDelayMs: 5_000 }
  }),
  { ok: false, error: 'SCHEDULE_NOT_FOUND' }
);

// HTTP authenticates before reading PATCH bodies and rejects mutation-shaped unknown fields.
let bodyReads = 0;
const freshStore = createTaskScheduleStore({ now });
const freshCommands = createScheduleCommandBoundary({
  store: freshStore,
  registry,
  createTraceId: () => 'fresh-trace'
});
const fresh = await freshCommands.create({
  principal,
  input: { agentId: 'minimal-engineer', task: 'immutable task', runAt: '2026-08-15T12:00:00Z' }
});
const authApi = createScheduleHttpApi({
  authenticator: {
    authenticate: ({ headers }) => headers?.authorization === 'ok'
      ? { ok: true, principal }
      : { ok: false }
  },
  commands: freshCommands,
  async readJson(request) {
    bodyReads += 1;
    return request.body;
  }
});
const unauthorized = await authApi.handle({
  method: 'PATCH', pathname: `/api/schedules/${fresh.schedule.scheduleId}`, headers: {},
  request: { body: { runAt: '2026-08-15T13:00:00Z' } }
});
assert.equal(unauthorized.status, 401);
assert.equal(bodyReads, 0);
const injected = await authApi.handle({
  method: 'PATCH', pathname: `/api/schedules/${fresh.schedule.scheduleId}`, headers: { authorization: 'ok' },
  request: { body: { runAt: '2026-08-15T13:00:00Z', task: 'replace me' } }
});
assert.equal(injected.status, 400);
assert.equal(injected.body.error, 'INVALID_SCHEDULE_COMMAND');
assert.equal(freshStore.read(fresh.schedule.scheduleId).task, 'immutable task');
assert.equal(freshStore.read(fresh.schedule.scheduleId).runAt, '2026-08-15T12:00:00.000Z');

console.log('parallel durable schedule and reschedule race tests passed');
