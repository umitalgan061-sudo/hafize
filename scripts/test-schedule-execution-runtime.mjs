import assert from 'node:assert/strict';
import { createScheduleExecutionRuntime } from '../lib/schedule-execution-runtime.mjs';

const calls = [];
const executor = {
  configured: true,
  async executeAgentTask(input) {
    calls.push(input);
    return { ok: true, source: 'base' };
  }
};

const plain = createScheduleExecutionRuntime({ executor });
assert.equal(plain.configured, true);
assert.equal(plain.leaseGuarded, false);
assert.equal(Object.isFrozen(plain), true);
assert.equal(plain.executeAgentTask, executor.executeAgentTask);
assert.deepEqual(await plain.executeAgentTask({ scheduleId: 'schedule_1' }), { ok: true, source: 'base' });
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
      async executeAgentTask(task) {
        return { ok: true, guarded: true, scheduleId: task.scheduleId };
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
  { ok: true, guarded: true, scheduleId: 'schedule_2' }
);

const unconfigured = createScheduleExecutionRuntime({
  executor: { configured: false, executeAgentTask: async () => ({ ok: false }) }
});
assert.equal(unconfigured.configured, false);
assert.equal(unconfigured.leaseGuarded, false);

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
