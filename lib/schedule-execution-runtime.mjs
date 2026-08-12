import { createScheduleLeaseGuardedExecutor } from './schedule-lease-executor.mjs';

function hasExecutor(executor) {
  return typeof executor?.executeAgentTask === 'function';
}

export function createScheduleExecutionRuntime({
  executor,
  lease = null,
  renewIntervalMs,
  createGuard = createScheduleLeaseGuardedExecutor
} = {}) {
  if (!hasExecutor(executor)) throw new Error('INVALID_SCHEDULE_EXECUTION_RUNTIME:executor');
  if (lease == null) {
    return Object.freeze({
      configured: Boolean(executor.configured),
      leaseGuarded: false,
      executeAgentTask: executor.executeAgentTask
    });
  }
  if (typeof createGuard !== 'function') throw new Error('INVALID_SCHEDULE_EXECUTION_RUNTIME:createGuard');

  let guarded;
  try {
    guarded = createGuard({
      lease,
      executeAgentTask: executor.executeAgentTask,
      renewIntervalMs
    });
  } catch {
    throw new Error('SCHEDULE_EXECUTION_RUNTIME_STARTUP_FAILED');
  }
  if (typeof guarded?.executeAgentTask !== 'function') {
    throw new Error('SCHEDULE_EXECUTION_RUNTIME_STARTUP_FAILED');
  }

  return Object.freeze({
    configured: Boolean(executor.configured),
    leaseGuarded: true,
    executeAgentTask: guarded.executeAgentTask
  });
}
