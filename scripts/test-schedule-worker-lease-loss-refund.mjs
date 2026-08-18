import assert from 'node:assert/strict';
import { createScheduleWorker, REFUNDABLE_INFRA_ERRORS } from '../lib/schedule-worker.mjs';

const registry = { agents: [{ id: 'minimal-engineer' }] };
const now = new Date('2026-08-18T03:00:00.000Z');
const schedule = {
  scheduleId: 'schedule_lease_lost',
  traceId: 'trace_lease_lost',
  agentId: 'minimal-engineer',
  task: 'continue safely',
  attempts: 1,
  maxAttempts: 1,
  retryDelayMs: 5_000
};
const deferred = [];
const failed = [];
const store = {
  async claimDue() { return [schedule]; },
  async complete() { throw new Error('unexpected complete'); },
  async fail(id, input) { failed.push([id, input]); },
  async defer(id, input) { deferred.push([id, input]); }
};
const worker = createScheduleWorker({
  store,
  registry,
  now: () => now,
  async executeAgentTask() {
    return { ok: false, error: 'SCHEDULE_LEASE_LOST' };
  }
});

const run = await worker.runDue({ limit: 1 });
assert.equal(run.claimed, 1);
assert.equal(failed.length, 0);
assert.deepEqual(deferred, [[
  'schedule_lease_lost',
  { error: 'SCHEDULE_LEASE_LOST', runAt: '2026-08-18T03:00:05.000Z' }
]]);
assert.deepEqual(run.results, [{
  scheduleId: 'schedule_lease_lost',
  ok: false,
  error: 'SCHEDULE_LEASE_LOST',
  retryScheduled: true,
  retryAt: '2026-08-18T03:00:05.000Z',
  attemptRefunded: true
}]);
assert.deepEqual([...REFUNDABLE_INFRA_ERRORS].sort(), ['SCHEDULE_LEASE_BUSY', 'SCHEDULE_LEASE_LOST']);
console.log('schedule worker lease-loss refund ok');
