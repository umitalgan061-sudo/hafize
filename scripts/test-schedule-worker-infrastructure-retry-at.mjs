import assert from 'node:assert/strict';
import { createScheduleWorker } from '../lib/schedule-worker.mjs';

const registry = { agents: [{ id: 'minimal-engineer' }] };
const base = '2026-08-18T03:30:00.000Z';

async function runWithRetryAt(retryAt) {
  const deferred = [];
  const schedule = {
    scheduleId: 'schedule_retry_at',
    traceId: 'trace_retry_at',
    agentId: 'minimal-engineer',
    task: 'retry later',
    attempts: 1,
    maxAttempts: 1,
    retryDelayMs: 7_000
  };
  const worker = createScheduleWorker({
    store: {
      async claimDue() { return [schedule]; },
      async complete() { throw new Error('unexpected complete'); },
      async fail() { throw new Error('unexpected fail'); },
      async defer(id, input) { deferred.push([id, input]); }
    },
    registry,
    now: () => new Date(base),
    async executeAgentTask() {
      return { ok: false, error: 'SCHEDULE_LEASE_LOST', retryAt };
    }
  });
  const run = await worker.runDue({ limit: 1 });
  return { deferred, result: run.results[0] };
}

const provided = await runWithRetryAt('2026-08-18T03:30:03.500Z');
assert.equal(provided.deferred[0][1].runAt, '2026-08-18T03:30:03.500Z');
assert.equal(provided.result.retryAt, '2026-08-18T03:30:03.500Z');

for (const invalid of [undefined, null, '', 'not-a-date', '2026-08-18T03:29:59.999Z', base]) {
  const fallback = await runWithRetryAt(invalid);
  assert.equal(fallback.deferred[0][1].runAt, '2026-08-18T03:30:07.000Z');
  assert.equal(fallback.result.retryAt, '2026-08-18T03:30:07.000Z');
}
console.log('schedule worker infrastructure retryAt ok');
