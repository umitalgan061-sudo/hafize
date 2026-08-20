const DEFAULT_EXECUTION_ERROR = 'SCHEDULE_EXECUTION_FAILED';
const LEASE_BUSY_ERROR = 'SCHEDULE_LEASE_BUSY';
const LEASE_LOST_ERROR = 'SCHEDULE_LEASE_LOST';
const EXECUTION_CANCELLED_ERROR = 'SCHEDULE_EXECUTION_CANCELLED';

function cleanInterval(value, leaseMs) {
  const fallback = Math.max(250, Math.floor(leaseMs / 2));
  if (!Number.isInteger(value)) return fallback;
  return Math.min(Math.max(value, 100), Math.max(100, leaseMs - 100));
}

function hasLeaseContract(lease) {
  return (
    typeof lease?.acquire === 'function' &&
    typeof lease?.renew === 'function' &&
    typeof lease?.complete === 'function' &&
    typeof lease?.release === 'function' &&
    Number.isInteger(lease?.leaseMs) &&
    lease.leaseMs >= 1_000
  );
}

function validSignal(signal) {
  return signal == null || (
    typeof signal === 'object' &&
    typeof signal.aborted === 'boolean' &&
    typeof signal.addEventListener === 'function' &&
    typeof signal.removeEventListener === 'function'
  );
}

function cancellationResult() {
  return { ok: false, error: EXECUTION_CANCELLED_ERROR };
}

function leaseLostResult({ executionStarted = false } = {}) {
  const outcomeUnknown = executionStarted === true;
  return {
    ok: false,
    error: LEASE_LOST_ERROR,
    outcomeUnknown,
    retrySafe: !outcomeUnknown
  };
}

export function createScheduleLeaseGuardedExecutor({
  lease,
  executeAgentTask,
  renewIntervalMs
} = {}) {
  if (!hasLeaseContract(lease)) throw new Error('INVALID_SCHEDULE_LEASE_EXECUTOR:lease');
  if (typeof executeAgentTask !== 'function') throw new Error('INVALID_SCHEDULE_LEASE_EXECUTOR:executeAgentTask');

  const renewEveryMs = cleanInterval(renewIntervalMs, lease.leaseMs);

  async function execute(input = {}) {
    const scheduleId = typeof input?.scheduleId === 'string' ? input.scheduleId.trim() : '';
    const callerSignal = input?.signal ?? null;
    if (!scheduleId || !validSignal(callerSignal)) return { ok: false, error: 'INVALID_SCHEDULE_AGENT_TASK' };
    if (callerSignal?.aborted) return cancellationResult();

    const acquired = await lease.acquire(scheduleId);
    if (acquired.status === 'busy') {
      return { ok: false, error: LEASE_BUSY_ERROR, retryAt: acquired.retryAt };
    }
    if (acquired.status === 'completed') {
      return { ok: true, deduplicated: true, leaseStatus: 'completed' };
    }

    const fence = acquired.fence;
    if (callerSignal?.aborted) {
      try {
        const release = await lease.release({ scheduleId, fence });
        if (release.status === 'stale') return leaseLostResult({ executionStarted: false });
        if (release.status === 'completed') {
          return { ok: true, deduplicated: true, leaseStatus: 'completed' };
        }
        return cancellationResult();
      } catch {
        return leaseLostResult({ executionStarted: false });
      }
    }

    const executionController = new AbortController();
    let stopped = false;
    let renewing = null;
    let leaseLost = false;
    let callerCancelled = false;
    let executionStarted = false;

    function markLeaseLost() {
      leaseLost = true;
      if (!executionController.signal.aborted) executionController.abort(LEASE_LOST_ERROR);
    }

    function markCallerCancelled() {
      callerCancelled = true;
      if (!executionController.signal.aborted) executionController.abort(EXECUTION_CANCELLED_ERROR);
    }

    callerSignal?.addEventListener('abort', markCallerCancelled, { once: true });
    if (callerSignal?.aborted) markCallerCancelled();

    async function renewOnce() {
      if (stopped || leaseLost || callerCancelled || renewing) return renewing;
      renewing = (async () => {
        try {
          const renewed = await lease.renew({ scheduleId, fence });
          if (renewed.status !== 'renewed') markLeaseLost();
        } catch {
          markLeaseLost();
        } finally {
          renewing = null;
        }
      })();
      return renewing;
    }

    const timer = setInterval(() => {
      void renewOnce();
    }, renewEveryMs);
    timer.unref?.();

    let result;
    try {
      executionStarted = true;
      result = await executeAgentTask({ ...input, signal: executionController.signal });
    } catch {
      result = { ok: false, error: callerCancelled ? EXECUTION_CANCELLED_ERROR : DEFAULT_EXECUTION_ERROR };
    } finally {
      stopped = true;
      clearInterval(timer);
      callerSignal?.removeEventListener('abort', markCallerCancelled);
      if (renewing) await renewing;
    }

    if (leaseLost) return leaseLostResult({ executionStarted });

    if (callerCancelled) {
      try {
        const release = await lease.release({ scheduleId, fence });
        if (release.status === 'stale') return leaseLostResult({ executionStarted });
        if (release.status === 'completed') {
          return { ok: true, deduplicated: true, leaseStatus: 'completed' };
        }
        return cancellationResult();
      } catch {
        return leaseLostResult({ executionStarted });
      }
    }

    if (result?.ok) {
      try {
        const completion = await lease.complete({ scheduleId, fence });
        if (completion.status === 'stale') return leaseLostResult({ executionStarted });
        return {
          ...result,
          leaseStatus: completion.status,
          deduplicated: completion.status === 'already_completed' || Boolean(result.deduplicated)
        };
      } catch {
        return leaseLostResult({ executionStarted });
      }
    }

    try {
      const release = await lease.release({ scheduleId, fence });
      if (release.status === 'stale') return leaseLostResult({ executionStarted });
      if (release.status === 'completed') {
        return { ok: true, deduplicated: true, leaseStatus: 'completed' };
      }
      return result && typeof result === 'object'
        ? result
        : { ok: false, error: DEFAULT_EXECUTION_ERROR };
    } catch {
      return leaseLostResult({ executionStarted });
    }
  }

  return Object.freeze({ renewIntervalMs: renewEveryMs, executeAgentTask: execute });
}

export { EXECUTION_CANCELLED_ERROR, LEASE_BUSY_ERROR, LEASE_LOST_ERROR, leaseLostResult, validSignal };
