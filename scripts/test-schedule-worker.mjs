import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';
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

console.log('schedule worker tests passed');
