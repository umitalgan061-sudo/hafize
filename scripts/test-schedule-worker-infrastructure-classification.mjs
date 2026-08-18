import assert from 'node:assert/strict';
import { createScheduleWorker } from '../lib/schedule-worker.mjs';

const registry = { agents: [{ id: 'minimal-engineer' }] };
const now = () => new Date('2026-08-18T03:20:00.000Z');

async function exercise(error) {
  const deferred = [];
  const failed = [];
  const schedule = {
    scheduleId: `schedule_${error.toLowerCase()}`,
    traceId: 'trace_infra_classification',
    agentId: 'minimal-engineer',
    task: 'classify failure',
    attempts: 1,
    maxAttempts: 1,
    retryDelayMs: 1_000
  };
  const store = {
    async claimDue() { return [schedule]; },
    async complete() { throw new Error('unexpected complete'); },
    async fail(id, input) { failed.push([id, input]); },
    async defer(id, input) { deferred.push([id, input]); }
  };
  const worker = createScheduleWorker({
    store,
    registry,
    now,
    async executeAgentTask() { return { ok: false, error }; }
  });
  return { run: await worker.runDue({ limit: 1 }), deferred, failed };
}

for (const error of ['SCHEDULE_LEASE_BUSY', 'SCHEDULE_LEASE_LOST']) {
  const result = await exercise(error);
  assert.equal(result.deferred.length, 1);
  assert.equal(result.failed.length, 0);
  assert.equal(result.deferred[0][1].error, error);
  assert.equal(result.run.results[0].attemptRefunded, true);
}

for (const error of ['SCHEDULE_EXECUTION_FAILED', 'MODEL_PROVIDER_FAILED', 'SCHEDULE_NOT_A_REAL_INFRA_ERROR']) {
  const result = await exercise(error);
  assert.equal(result.deferred.length, 0);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0][1].error, error);
  assert.equal(result.run.results[0].attemptRefunded, undefined);
  assert.equal(result.run.results[0].retryScheduled, false);
}
console.log('schedule worker infrastructure classification ok');
