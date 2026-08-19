import assert from 'node:assert/strict';
import { createScheduleLeaseGuardedExecutor } from '../lib/schedule-lease-executor.mjs';
import { createScheduledAgentExecutor } from '../lib/scheduled-agent-executor.mjs';

const agent = {
  id: 'agency-code-reviewer',
  name: 'Code Reviewer',
  kind: 'specialist',
  description: 'Salt-okunur kod inceleme ajanı.',
  toolPolicy: { default: 'deny', allow: ['repo.read'] }
};
const registry = { agents: [agent] };

function createLeaseHarness() {
  let active = null;
  let fenceCounter = 0;
  const calls = [];

  return {
    leaseMs: 1_000,
    calls,
    get active() {
      return active;
    },
    async acquire(scheduleId) {
      calls.push(['acquire', scheduleId]);
      if (active) return { status: 'busy', retryAt: new Date(Date.now() + 1_000).toISOString() };
      fenceCounter += 1;
      active = { scheduleId, fence: `fence-${fenceCounter}` };
      return { status: 'acquired', fence: active.fence };
    },
    async renew({ scheduleId, fence }) {
      calls.push(['renew', scheduleId, fence]);
      if (!active || active.scheduleId !== scheduleId || active.fence !== fence) return { status: 'stale' };
      return { status: 'renewed' };
    },
    async complete({ scheduleId, fence }) {
      calls.push(['complete', scheduleId, fence]);
      if (!active || active.scheduleId !== scheduleId || active.fence !== fence) return { status: 'stale' };
      active = null;
      return { status: 'completed' };
    },
    async release({ scheduleId, fence }) {
      calls.push(['release', scheduleId, fence]);
      if (!active || active.scheduleId !== scheduleId || active.fence !== fence) return { status: 'stale' };
      active = null;
      return { status: 'released' };
    }
  };
}

{
  const lease = createLeaseHarness();
  let runCount = 0;
  const executor = createScheduledAgentExecutor({
    registry,
    model: 'mock-model',
    runTimeoutMs: 20,
    complete: async () => ({ choices: [] }),
    runAgentTask: async () => {
      runCount += 1;
      if (runCount === 1) return new Promise(() => {});
      return { ok: true, content: 'retry success' };
    }
  });
  const guarded = createScheduleLeaseGuardedExecutor({
    lease,
    executeAgentTask: executor.executeAgentTask,
    renewIntervalMs: 400
  });

  const firstStartedAt = Date.now();
  const first = await guarded.executeAgentTask({
    scheduleId: 'schedule-timeout-release',
    traceId: 'trace-timeout-release-1',
    agent,
    task: 'İlk koşu timeout olsun.'
  });
  const firstElapsed = Date.now() - firstStartedAt;

  assert.equal(first.ok, false);
  assert.equal(first.error, 'SCHEDULE_AGENT_RUN_TIMEOUT');
  assert.ok(firstElapsed < 1000, `lease-guarded timeout should settle promptly, got ${firstElapsed}ms`);
  assert.equal(lease.active, null, 'failed timed-out run must release its lease');
  assert.deepEqual(
    lease.calls.filter(([name]) => name === 'release').map(([, scheduleId]) => scheduleId),
    ['schedule-timeout-release']
  );
  assert.equal(
    lease.calls.some(([name]) => name === 'complete'),
    false,
    'timed-out run must never mark the lease completed'
  );

  const second = await guarded.executeAgentTask({
    scheduleId: 'schedule-timeout-release',
    traceId: 'trace-timeout-release-2',
    agent,
    task: 'Retry başarıyla tamamlanabilsin.'
  });

  assert.equal(second.ok, true);
  assert.equal(second.content, 'retry success');
  assert.equal(second.leaseStatus, 'completed');
  assert.equal(second.deduplicated, false);
  assert.equal(runCount, 2);
  assert.equal(lease.active, null);
  assert.equal(
    lease.calls.filter(([name]) => name === 'acquire').length,
    2,
    'same schedule must be acquirable again after timeout release'
  );
  assert.equal(lease.calls.filter(([name]) => name === 'release').length, 1);
  assert.equal(lease.calls.filter(([name]) => name === 'complete').length, 1);
}

{
  const lease = createLeaseHarness();
  const caller = new AbortController();
  const executor = createScheduledAgentExecutor({
    registry,
    model: 'mock-model',
    runTimeoutMs: 500,
    complete: async () => ({ choices: [] }),
    runAgentTask: async ({ signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    })
  });
  const guarded = createScheduleLeaseGuardedExecutor({
    lease,
    executeAgentTask: executor.executeAgentTask,
    renewIntervalMs: 400
  });

  const pending = guarded.executeAgentTask({
    scheduleId: 'schedule-caller-cancel-release',
    traceId: 'trace-caller-cancel-release',
    agent,
    task: 'Caller iptalini koru.',
    signal: caller.signal
  });
  setTimeout(() => caller.abort(), 10);
  const result = await pending;

  assert.equal(result.ok, false);
  assert.equal(result.error, 'SCHEDULE_EXECUTION_CANCELLED');
  assert.equal(lease.active, null, 'caller cancellation must also release the lease');
  assert.equal(lease.calls.filter(([name]) => name === 'release').length, 1);
  assert.equal(lease.calls.filter(([name]) => name === 'complete').length, 0);
}

console.log('scheduled agent timeout + lease integration tests passed');
