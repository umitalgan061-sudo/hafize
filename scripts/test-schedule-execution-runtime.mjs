import assert from 'node:assert/strict';
import {
  createScheduleExecutionRuntime,
  projectWorkerResult
} from '../lib/schedule-execution-runtime.mjs';

const calls = [];
const executor = {
  configured: true,
  async executeAgentTask(input) {
    calls.push(input);
    return { ok: true, content: 'completed', taskLedger: { traceId: 'trace-1' } };
  }
};

const plain = createScheduleExecutionRuntime({ executor });
assert.equal(plain.configured, true);
assert.equal(plain.leaseGuarded, false);
assert.equal(Object.isFrozen(plain), true);
assert.deepEqual(await plain.executeAgentTask({ scheduleId: 'schedule_1' }), { ok: true });
assert.equal(calls.length, 1);

let guardInput = null;
const lease = { name: 'distributed-lease' };
const guarded = createScheduleExecutionRuntime({
  executor,
  lease,
  renewIntervalMs: 1234,
  createGuard(input) {
    guardInput = input;
    return {
      async executeAgentTask() {
        return {
          ok: true,
          content: 'completed',
          taskLedger: { traceId: 'trace-2' },
          leaseStatus: 'completed',
          deduplicated: false
        };
      }
    };
  }
});
assert.equal(guarded.configured, true);
assert.equal(guarded.leaseGuarded, true);
assert.equal(Object.isFrozen(guarded), true);
assert.equal(guardInput.lease, lease);
assert.equal(guardInput.executeAgentTask, executor.executeAgentTask);
assert.equal(guardInput.renewIntervalMs, 1234);
assert.deepEqual(
  await guarded.executeAgentTask({ scheduleId: 'schedule_2' }),
  { ok: true },
  'known agent/lease metadata must not make a successful worker result contract-invalid'
);

assert.deepEqual(
  projectWorkerResult({
    ok: true,
    content: 'private model output',
    taskLedger: { traceId: 'trace-3' },
    leaseStatus: 'completed',
    deduplicated: false
  }),
  { ok: true },
  'known internal execution metadata must not cross into the worker result contract'
);
assert.deepEqual(
  projectWorkerResult({
    ok: false,
    error: 'SCHEDULE_LEASE_BUSY',
    retryAt: '2026-08-20T20:00:00.000Z',
    taskLedger: { traceId: 'trace-4' }
  }),
  { ok: false, error: 'SCHEDULE_LEASE_BUSY', retryAt: '2026-08-20T20:00:00.000Z' }
);
assert.deepEqual(
  projectWorkerResult({ ok: true, deduplicated: true, leaseStatus: 'completed' }),
  { ok: true },
  'completed lease deduplication metadata must normalize to a successful worker result'
);
const unexpected = { ok: true, content: 'x', unexpected: 'must not be hidden' };
assert.equal(projectWorkerResult(unexpected), unexpected);
const accessor = { ok: true };
Object.defineProperty(accessor, 'content', {
  enumerable: true,
  get() { throw new Error('getter must not execute'); }
});
assert.equal(projectWorkerResult(accessor), accessor);

const unconfigured = createScheduleExecutionRuntime({
  executor: { configured: false, executeAgentTask: async () => ({ ok: false, error: 'NOT_CONFIGURED' }) }
});
assert.equal(unconfigured.configured, false);
assert.equal(unconfigured.leaseGuarded, false);
assert.deepEqual(await unconfigured.executeAgentTask({}), { ok: false, error: 'NOT_CONFIGURED' });

assert.throws(
  () => createScheduleExecutionRuntime(),
  /INVALID_SCHEDULE_EXECUTION_RUNTIME:executor/
);
assert.throws(
  () => createScheduleExecutionRuntime({ executor, lease, createGuard: null }),
  /INVALID_SCHEDULE_EXECUTION_RUNTIME:createGuard/
);
assert.throws(
  () => createScheduleExecutionRuntime({
    executor,
    lease,
    createGuard() {
      throw new Error('secret provider detail');
    }
  }),
  (error) => error.message === 'SCHEDULE_EXECUTION_RUNTIME_STARTUP_FAILED' && !error.message.includes('secret provider detail')
);
assert.throws(
  () => createScheduleExecutionRuntime({ executor, lease, createGuard: () => ({}) }),
  /SCHEDULE_EXECUTION_RUNTIME_STARTUP_FAILED/
);

console.log('schedule execution runtime tests passed');
