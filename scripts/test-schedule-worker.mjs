import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';
import { createTaskSchedulePersistence } from '../lib/task-schedule-persistence.mjs';
import { createScheduleWorker } from '../lib/schedule-worker.mjs';

let clock = new Date('2026-08-12T10:00:00.000Z');
const now = () => new Date(clock);
const store = createTaskScheduleStore({ now });
const registry = {
  agents: [
    { id: 'hafize-general', name: 'Hafize' },
    { id: 'agency-code-reviewer', name: 'Code Reviewer' }
  ]
};

const success = store.add({
  traceId: 'trace-success',
  agentId: 'hafize-general',
  task: 'Günlük özeti hazırla.',
  runAt: '2026-08-12T09:59:00.000Z',
  maxAttempts: 2
});
const retry = store.add({
  traceId: 'trace-retry',
  agentId: 'agency-code-reviewer',
  task: 'Repo durumunu incele.',
  runAt: '2026-08-12T09:59:30.000Z',
  maxAttempts: 2
});
const missing = store.add({
  traceId: 'trace-missing',
  agentId: 'missing-agent',
  task: 'Çalışmamalı.',
  runAt: '2026-08-12T09:59:45.000Z'
});

const seen = [];
const worker = createScheduleWorker({
  store,
  registry,
  now,
  retryDelayMs: 60_000,
  maxBatch: 8,
  async executeAgentTask(input) {
    seen.push(input);
    if (input.traceId === 'trace-retry') return { ok: false, error: 'TEMPORARY_FAILURE' };
    return { ok: true };
  }
});

const first = await worker.runDue();
assert.equal(first.claimed, 3);
assert.equal(seen.length, 2);
assert.equal(seen[0].traceId, 'trace-success');
assert.equal(seen[0].agent.id, 'hafize-general');
assert.equal(seen[0].attempt, 1);
assert.equal(store.read(success.scheduleId).status, 'completed');
assert.equal(store.read(retry.scheduleId).status, 'scheduled');
assert.equal(store.read(retry.scheduleId).runAt, '2026-08-12T10:01:00.000Z');
assert.equal(store.read(retry.scheduleId).lastError, 'TEMPORARY_FAILURE');
assert.equal(store.read(missing.scheduleId).status, 'failed');
assert.equal(store.read(missing.scheduleId).lastError, 'SCHEDULE_AGENT_NOT_FOUND');

clock = new Date('2026-08-12T10:01:00.000Z');
const second = await worker.runDue();
assert.equal(second.claimed, 1);
assert.equal(store.read(retry.scheduleId).status, 'failed');
assert.equal(store.read(retry.scheduleId).attempts, 2);

const throwingStore = createTaskScheduleStore({ now });
const throwing = throwingStore.add({
  traceId: 'trace-throw',
  agentId: 'hafize-general',
  task: 'Hata üret.',
  runAt: '2026-08-12T10:00:30.000Z'
});
const throwingWorker = createScheduleWorker({
  store: throwingStore,
  registry,
  now,
  async executeAgentTask() {
    throw new Error('secret internal detail');
  }
});
const thrown = await throwingWorker.runDue();
assert.equal(thrown.results[0].error, 'SCHEDULE_EXECUTION_FAILED');
assert.equal(throwingStore.read(throwing.scheduleId).lastError, 'SCHEDULE_EXECUTION_FAILED');
assert.equal(JSON.stringify(thrown).includes('secret internal detail'), false);

const boundedStore = createTaskScheduleStore({ now });
for (let i = 0; i < 3; i += 1) {
  boundedStore.add({
    traceId: `trace-${i}`,
    agentId: 'hafize-general',
    task: `Görev ${i}`,
    runAt: '2026-08-12T10:00:00.000Z'
  });
}
const boundedWorker = createScheduleWorker({
  store: boundedStore,
  registry,
  now,
  maxBatch: 2,
  executeAgentTask: async () => ({ ok: true })
});
const bounded = await boundedWorker.runDue({ limit: 99 });
assert.equal(bounded.claimed, 2);
assert.equal(boundedStore.snapshot().entries.filter((entry) => entry.status === 'scheduled').length, 1);

let durableEnvelope = null;
const durableStore = createTaskSchedulePersistence({
  adapter: {
    async load() {
      return durableEnvelope;
    },
    async save(envelope) {
      durableEnvelope = structuredClone(envelope);
    }
  },
  storeOptions: { now }
});
await durableStore.open();
const durableSuccess = await durableStore.add({
  traceId: 'trace-durable-success',
  agentId: 'hafize-general',
  task: 'Kalıcı başarı.',
  runAt: '2026-08-12T10:00:00.000Z'
});
const durableFailure = await durableStore.add({
  traceId: 'trace-durable-failure',
  agentId: 'agency-code-reviewer',
  task: 'Kalıcı hata.',
  runAt: '2026-08-12T10:00:00.000Z'
});
const durableWorker = createScheduleWorker({
  store: durableStore,
  registry,
  now,
  async executeAgentTask(input) {
    return input.traceId === 'trace-durable-failure'
      ? { ok: false, error: 'DURABLE_FAILURE' }
      : { ok: true };
  }
});
const durableResult = await durableWorker.runDue({ limit: 2 });
assert.equal(durableResult.claimed, 2);
assert.equal(durableStore.read(durableSuccess.scheduleId).status, 'completed');
assert.equal(durableStore.read(durableFailure.scheduleId).status, 'failed');
assert.equal(durableStore.read(durableFailure.scheduleId).lastError, 'DURABLE_FAILURE');
assert.equal(durableEnvelope.snapshot.entries.find((entry) => entry.scheduleId === durableSuccess.scheduleId).status, 'completed');
assert.equal(durableEnvelope.snapshot.entries.find((entry) => entry.scheduleId === durableFailure.scheduleId).status, 'failed');

const claimSeed = createTaskScheduleStore({ now });
const claimTask = claimSeed.add({
  traceId: 'trace-claim-save-failure',
  agentId: 'hafize-general',
  task: 'Claim persist olmadan çalışmamalı.',
  runAt: '2026-08-12T10:00:00.000Z'
});
const claimFailureStore = createTaskSchedulePersistence({
  adapter: {
    async load() {
      return { schemaVersion: 1, snapshot: claimSeed.snapshot() };
    },
    async save() {
      throw new Error('secret persistence detail');
    }
  },
  storeOptions: { now }
});
await claimFailureStore.open();
let claimFailureExecutions = 0;
const claimFailureWorker = createScheduleWorker({
  store: claimFailureStore,
  registry,
  now,
  async executeAgentTask() {
    claimFailureExecutions += 1;
    return { ok: true };
  }
});
await assert.rejects(() => claimFailureWorker.runDue(), /SCHEDULE_PERSISTENCE_SAVE_FAILED/);
assert.equal(claimFailureExecutions, 0);
assert.equal(claimFailureStore.read(claimTask.scheduleId).status, 'scheduled');

const completeSeed = createTaskScheduleStore({ now });
const completeTask = completeSeed.add({
  traceId: 'trace-complete-save-failure',
  agentId: 'hafize-general',
  task: 'Completion persist hatasını gizleme.',
  runAt: '2026-08-12T10:00:00.000Z'
});
let completeEnvelope = { schemaVersion: 1, snapshot: completeSeed.snapshot() };
let completeSaveCount = 0;
const completeFailureStore = createTaskSchedulePersistence({
  adapter: {
    async load() {
      return completeEnvelope;
    },
    async save(envelope) {
      completeSaveCount += 1;
      if (completeSaveCount === 2) throw new Error('secret completion persistence detail');
      completeEnvelope = structuredClone(envelope);
    }
  },
  storeOptions: { now }
});
await completeFailureStore.open();
let completeExecutions = 0;
const completeFailureWorker = createScheduleWorker({
  store: completeFailureStore,
  registry,
  now,
  async executeAgentTask() {
    completeExecutions += 1;
    return { ok: true };
  }
});
await assert.rejects(() => completeFailureWorker.runDue(), /SCHEDULE_PERSISTENCE_SAVE_FAILED/);
assert.equal(completeExecutions, 1);
assert.equal(completeFailureStore.read(completeTask.scheduleId).status, 'running');
assert.equal(completeEnvelope.snapshot.entries[0].status, 'running');

clock = new Date('2026-08-12T11:00:00.000Z');
let leaseEnvelope = null;
const leaseBusyStore = createTaskSchedulePersistence({
  adapter: {
    async load() {
      return leaseEnvelope;
    },
    async save(envelope) {
      leaseEnvelope = structuredClone(envelope);
    }
  },
  storeOptions: { now }
});
await leaseBusyStore.open();
const leaseBusyTask = await leaseBusyStore.add({
  traceId: 'trace-lease-busy',
  agentId: 'hafize-general',
  task: 'Lease boşalınca çalış.',
  runAt: '2026-08-12T11:00:00.000Z',
  maxAttempts: 1
});
let leaseCalls = 0;
const leaseBusyWorker = createScheduleWorker({
  store: leaseBusyStore,
  registry,
  now,
  async executeAgentTask() {
    leaseCalls += 1;
    if (leaseCalls === 1) {
      return { ok: false, error: 'SCHEDULE_LEASE_BUSY', retryAt: '2026-08-12T11:02:00.000Z' };
    }
    return { ok: true };
  }
});
const leaseBusyResult = await leaseBusyWorker.runDue();
assert.equal(leaseBusyResult.claimed, 1);
assert.equal(leaseBusyResult.results[0].attemptRefunded, true);
assert.equal(leaseBusyResult.results[0].retryAt, '2026-08-12T11:02:00.000Z');
assert.equal(leaseBusyStore.read(leaseBusyTask.scheduleId).status, 'scheduled');
assert.equal(leaseBusyStore.read(leaseBusyTask.scheduleId).attempts, 0);
assert.equal(leaseBusyStore.read(leaseBusyTask.scheduleId).lastError, 'SCHEDULE_LEASE_BUSY');
assert.equal(leaseEnvelope.snapshot.entries[0].attempts, 0);
assert.equal(leaseEnvelope.snapshot.entries[0].runAt, '2026-08-12T11:02:00.000Z');

clock = new Date('2026-08-12T11:02:00.000Z');
const leaseRetryResult = await leaseBusyWorker.runDue();
assert.equal(leaseRetryResult.claimed, 1);
assert.equal(leaseCalls, 2);
assert.equal(leaseBusyStore.read(leaseBusyTask.scheduleId).status, 'completed');
assert.equal(leaseBusyStore.read(leaseBusyTask.scheduleId).attempts, 1);
assert.equal(leaseEnvelope.snapshot.entries[0].status, 'completed');
assert.equal(leaseEnvelope.snapshot.entries[0].attempts, 1);

console.log('schedule worker tests passed');
