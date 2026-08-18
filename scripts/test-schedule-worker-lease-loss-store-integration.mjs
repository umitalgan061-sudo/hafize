import assert from 'node:assert/strict';
import { createScheduleWorker } from '../lib/schedule-worker.mjs';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

let clock = new Date('2026-08-18T03:10:00.000Z');
const now = () => new Date(clock);
const store = createTaskScheduleStore({ now });
const registry = { agents: [{ id: 'minimal-engineer' }] };
store.add({
  scheduleId: 'schedule_store_lease_loss',
  traceId: 'trace_store_lease_loss',
  agentId: 'minimal-engineer',
  task: 'bounded work',
  runAt: clock.toISOString(),
  maxAttempts: 1,
  retryDelayMs: 2_000
});

let calls = 0;
const worker = createScheduleWorker({
  store,
  registry,
  now,
  async executeAgentTask() {
    calls += 1;
    if (calls === 1) return { ok: false, error: 'SCHEDULE_LEASE_LOST' };
    return { ok: true };
  }
});

const first = await worker.runDue({ limit: 1 });
assert.equal(first.results[0].error, 'SCHEDULE_LEASE_LOST');
assert.equal(first.results[0].attemptRefunded, true);
let task = store.read('schedule_store_lease_loss');
assert.equal(task.status, 'scheduled');
assert.equal(task.attempts, 0);
assert.equal(task.lastError, 'SCHEDULE_LEASE_LOST');
assert.equal(task.runAt, '2026-08-18T03:10:02.000Z');

clock = new Date('2026-08-18T03:10:02.000Z');
const second = await worker.runDue({ limit: 1 });
assert.equal(second.results[0].ok, true);
task = store.read('schedule_store_lease_loss');
assert.equal(task.status, 'completed');
assert.equal(task.attempts, 1);
assert.equal(calls, 2);
console.log('schedule worker lease-loss store integration ok');
