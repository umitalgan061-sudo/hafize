import assert from 'node:assert/strict';
import { createScheduleWorker, SCHEDULE_WORKER_LIMITS } from '../lib/schedule-worker.mjs';

const registry = { agents: [{ id: 'minimal-engineer' }] };
const base = new Date('2026-08-18T04:10:00.000Z');

async function deferFor(retryAt) {
  const deferred = [];
  const worker = createScheduleWorker({
    registry,
    now: () => new Date(base),
    store: {
      async claimDue() {
        return [{
          scheduleId: 'schedule-horizon', traceId: 'trace-horizon', agentId: 'minimal-engineer',
          task: 'retry safely', attempts: 1, maxAttempts: 1, retryDelayMs: 5_000
        }];
      },
      async complete() { throw new Error('unexpected complete'); },
      async fail() { throw new Error('unexpected fail'); },
      async defer(id, input) { deferred.push([id, input]); }
    },
    async executeAgentTask() { return { ok: false, error: 'SCHEDULE_LEASE_BUSY', retryAt }; }
  });
  const run = await worker.runDue({ limit: 1 });
  return { deferred, result: run.results[0] };
}

assert.equal(SCHEDULE_WORKER_LIMITS.maxInfraRetryHorizonMs, 86_400_000);
const exact = new Date(base.getTime() + 86_400_000).toISOString();
assert.equal((await deferFor(exact)).result.retryAt, exact);

for (const excessive of [
  new Date(base.getTime() + 86_400_001).toISOString(),
  new Date(base.getTime() + 7 * 86_400_000).toISOString(),
  '9999-12-31T23:59:59.999Z'
]) {
  const run = await deferFor(excessive);
  assert.equal(run.result.retryAt, '2026-08-18T04:10:05.000Z');
  assert.equal(run.deferred[0][1].runAt, '2026-08-18T04:10:05.000Z');
  assert.equal(run.result.attemptRefunded, true);
}
console.log('schedule worker infrastructure retry horizon ok');
