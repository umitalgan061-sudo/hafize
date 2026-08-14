import assert from 'node:assert/strict';
import { createScheduleLeaseGuardedExecutor } from '../lib/schedule-lease-executor.mjs';
import { createScheduledAgentExecutor } from '../lib/scheduled-agent-executor.mjs';

function createLease(overrides = {}) {
  return {
    leaseMs: 1_000,
    acquire: async () => ({ status: 'acquired', fence: 7 }),
    renew: async () => ({ status: 'renewed' }),
    complete: async () => ({ status: 'completed' }),
    release: async () => ({ status: 'released' }),
    ...overrides
  };
}

let leaseSignal = null;
let leaseAbortReason = null;
const guarded = createScheduleLeaseGuardedExecutor({
  lease: createLease({ renew: async () => ({ status: 'stale' }) }),
  renewIntervalMs: 100,
  executeAgentTask: async ({ signal }) => {
    leaseSignal = signal;
    await new Promise((resolve) => {
      if (signal.aborted) resolve();
      else signal.addEventListener('abort', resolve, { once: true });
    });
    leaseAbortReason = signal.reason;
    return { ok: false, error: 'SHOULD_BE_OVERRIDDEN' };
  }
});
const started = Date.now();
const lost = await guarded.executeAgentTask({ scheduleId: 'schedule_cancel_1' });
assert.deepEqual(lost, { ok: false, error: 'SCHEDULE_LEASE_LOST' });
assert.equal(leaseSignal?.aborted, true);
assert.equal(leaseAbortReason, 'SCHEDULE_LEASE_LOST');
assert.ok(Date.now() - started < 500);

const registry = { agents: [{ id: 'hafize-general', name: 'Hafize' }] };
const controller = new AbortController();
let completionSignal = null;
let underlyingFinished = false;
const scheduled = createScheduledAgentExecutor({
  registry,
  model: 'mock/model',
  complete: async (_payload, signal) => {
    completionSignal = signal;
    await new Promise((resolve) => setTimeout(resolve, 250));
    underlyingFinished = true;
    return { choices: [{ message: { role: 'assistant', content: 'late' } }] };
  },
  async runAgentTask(input) {
    await input.complete({ model: 'mock/model' }, input.signal);
    return { ok: true, content: 'should-not-complete' };
  }
});
setTimeout(() => controller.abort('lease-lost'), 25).unref?.();
const cancellationStarted = Date.now();
const cancelled = await scheduled.executeAgentTask({
  traceId: 'trace-schedule-cancel',
  agent: registry.agents[0],
  task: 'çalış',
  signal: controller.signal
});
assert.equal(cancelled.ok, false);
assert.equal(cancelled.error, 'SCHEDULE_AGENT_RUN_CANCELLED');
assert.equal(cancelled.taskLedger.entries[0].status, 'failed');
assert.equal(completionSignal, controller.signal);
assert.equal(underlyingFinished, false);
assert.ok(Date.now() - cancellationStarted < 180);

const preAborted = new AbortController();
preAborted.abort('already-cancelled');
assert.deepEqual(
  await scheduled.executeAgentTask({
    traceId: 'trace-pre-aborted',
    agent: registry.agents[0],
    task: 'çalış',
    signal: preAborted.signal
  }),
  { ok: false, error: 'SCHEDULE_AGENT_RUN_CANCELLED' }
);

console.log('schedule cancellation tests passed');
