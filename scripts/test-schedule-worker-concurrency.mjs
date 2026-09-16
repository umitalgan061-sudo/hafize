import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';
import { createScheduleWorker } from '../lib/schedule-worker.mjs';

const fixedNow = new Date('2026-09-16T06:00:00.000Z');
const store = createTaskScheduleStore({ now: () => fixedNow });
const registry = { agents: [{ id: 'hafize-general' }] };
for (let index = 0; index < 24; index += 1) {
  store.add({ traceId: `trace-${index}`, agentId: 'hafize-general', task: `task-${index}`, runAt: '2026-09-16T05:00:00.000Z', maxAttempts: 1, ownerId: 'worker-test' });
}

let active = 0;
let peak = 0;
const executed = [];
const worker = createScheduleWorker({
  store,
  registry,
  maxBatch: 8,
  maxConcurrent: 3,
  maxBatchesPerTick: 4,
  executeAgentTask: async ({ scheduleId, task, attempt }) => {
    active += 1;
    peak = Math.max(peak, active);
    executed.push({ scheduleId, task, attempt });
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return { ok: true };
  }
});

const result = await worker.runDue({ limit: 24 });
assert.equal(result.claimed, 24);
assert.equal(result.batches, 3);
assert.equal(result.concurrency, 3);
assert.equal(result.results.length, 24);
assert.equal(peak, 3);
assert.equal(new Set(executed.map((item) => item.scheduleId)).size, 24);
assert.equal(store.snapshot().entries.every((entry) => entry.status === 'completed'), true);

const retryStore = createTaskScheduleStore({ now: () => fixedNow });
retryStore.add({ traceId: 'retry', agentId: 'hafize-general', task: 'retry me', runAt: '2026-09-16T05:00:00.000Z', maxAttempts: 2 });
let attempts = 0;
const retryWorker = createScheduleWorker({
  store: retryStore,
  registry,
  retryDelayMs: 1000,
  executeAgentTask: async () => {
    attempts += 1;
    return attempts === 1 ? { ok: false, error: 'TRANSIENT_FAILURE' } : { ok: true };
  }
});
const retryResult = await retryWorker.runDue();
assert.equal(retryResult.claimed, 1);
assert.equal(retryResult.results[0].retryScheduled, true);
assert.equal(retryStore.snapshot().entries[0].status, 'scheduled');
assert.equal(retryStore.snapshot().entries[0].attempts, 1);

const missingAgentStore = createTaskScheduleStore({ now: () => fixedNow });
missingAgentStore.add({ traceId: 'missing', agentId: 'missing-agent', task: 'missing', runAt: '2026-09-16T05:00:00.000Z' });
const missingWorker = createScheduleWorker({
  store: missingAgentStore,
  registry,
  executeAgentTask: async () => ({ ok: true })
});
const missingResult = await missingWorker.runDue();
assert.equal(missingResult.results[0].error, 'SCHEDULE_AGENT_NOT_FOUND');
assert.equal(missingAgentStore.snapshot().entries[0].status, 'failed');

console.log('schedule worker concurrency tests passed');
