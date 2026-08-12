const DEFAULT_EXECUTION_ERROR = 'SCHEDULE_EXECUTION_FAILED';
const LEASE_BUSY_ERROR = 'SCHEDULE_LEASE_BUSY';
const LEASE_LOST_ERROR = 'SCHEDULE_LEASE_LOST';

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
    if (!scheduleId) return { ok: false, error: 'INVALID_SCHEDULE_AGENT_TASK' };

    const acquired = await lease.acquire(scheduleId);
    if (acquired.status === 'busy') {
      return { ok: false, error: LEASE_BUSY_ERROR, retryAt: acquired.retryAt };
    }
    if (acquired.status === 'completed') {
      return { ok: true, deduplicated: true, leaseStatus: 'completed' };
    }

    const fence = acquired.fence;
    let stopped = false;
    let renewing = null;
    let leaseLost = false;

    async function renewOnce() {
      if (stopped || leaseLost || renewing) return renewing;
      renewing = (async () => {
        try {
          const renewed = await lease.renew({ scheduleId, fence });
          if (renewed.status !== 'renewed') leaseLost = true;
        } catch {
          leaseLost = true;
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
      result = await executeAgentTask(input);
    } catch {
      result = { ok: false, error: DEFAULT_EXECUTION_ERROR };
    } finally {
      stopped = true;
      clearInterval(timer);
      if (renewing) await renewing;
    }

    if (leaseLost) return { ok: false, error: LEASE_LOST_ERROR };

    if (result?.ok) {
      const completion = await lease.complete({ scheduleId, fence });
      if (completion.status === 'stale') return { ok: false, error: LEASE_LOST_ERROR };
      return {
        ...result,
        leaseStatus: completion.status,
        deduplicated: completion.status === 'already_completed' || Boolean(result.deduplicated)
      };
    }

    const release = await lease.release({ scheduleId, fence });
    if (release.status === 'stale') return { ok: false, error: LEASE_LOST_ERROR };
    if (release.status === 'completed') {
      return { ok: true, deduplicated: true, leaseStatus: 'completed' };
    }
    return result && typeof result === 'object'
      ? result
      : { ok: false, error: DEFAULT_EXECUTION_ERROR };
  }

  return Object.freeze({ renewIntervalMs: renewEveryMs, executeAgentTask: execute });
}
