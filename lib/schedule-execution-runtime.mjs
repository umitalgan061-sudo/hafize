import { createScheduleLeaseGuardedExecutor } from './schedule-lease-executor.mjs';

const WORKER_RESULT_KEYS = new Set(['ok', 'error', 'retryAt']);
const INTERNAL_RESULT_METADATA_KEYS = new Set(['content', 'taskLedger', 'leaseStatus', 'deduplicated']);

function hasExecutor(executor) {
  return typeof executor?.executeAgentTask === 'function';
}

function projectWorkerResult(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors);
  if (keys.some((key) => !WORKER_RESULT_KEYS.has(key) && !INTERNAL_RESULT_METADATA_KEYS.has(key))) return value;
  if (keys.some((key) => !Object.prototype.hasOwnProperty.call(descriptors[key], 'value'))) return value;

  const ok = descriptors.ok?.value;
  if (ok === true) return Object.freeze({ ok: true });
  if (ok !== false) return value;

  const projected = {
    ok: false,
    error: descriptors.error?.value
  };
  if (Object.prototype.hasOwnProperty.call(descriptors, 'retryAt')) {
    projected.retryAt = descriptors.retryAt.value;
  }
  return Object.freeze(projected);
}

function workerFacingExecutor(executeAgentTask) {
  return async (input) => projectWorkerResult(await executeAgentTask(input));
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
      executeAgentTask: workerFacingExecutor(executor.executeAgentTask)
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
    executeAgentTask: workerFacingExecutor(guarded.executeAgentTask)
  });
}

export { projectWorkerResult };
