import assert from 'node:assert/strict';
import { createScheduleExecutionRuntime } from '../lib/schedule-execution-runtime.mjs';
import { createScheduleWorker, WORKER_CANCELLED_ERROR } from '../lib/schedule-worker.mjs';

const registry = { agents: [{ id: 'minimal-engineer' }] };
const fixedNow = () => new Date('2026-08-18T05:00:00.000Z');

function buildHarness() {
  const events = [];
  let resolveStarted;
  const started = new Promise((resolve) => { resolveStarted = resolve; });

  const lease = {
    leaseMs: 1_000,
    async acquire(scheduleId) {
      events.push(['lease.acquire', scheduleId]);
      return { status: 'acquired', fence: 17 };
    },
    async renew({ scheduleId, fence }) {
      events.push(['lease.renew', scheduleId, fence]);
      return { status: 'renewed' };
    },
    async complete({ scheduleId, fence }) {
      events.push(['lease.complete', scheduleId, fence]);
      return { status: 'completed' };
    },
    async release({ scheduleId, fence }) {
      events.push(['lease.release', scheduleId, fence]);
      return { status: 'released' };
    }
  };

  const executor = {
    configured: true,
    async executeAgentTask({ signal }) {
      events.push(['executor.start', signal.aborted]);
      resolveStarted();
      await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
      events.push(['executor.abort', signal.aborted]);
      return { ok: false, error: 'SCHEDULE_AGENT_RUN_CANCELLED' };
    }
  };

  const runtime = createScheduleExecutionRuntime({ executor, lease, renewIntervalMs: 100 });
  const store = {
    async claimDue({ limit }) {
      events.push(['store.claim', limit]);
      return [{
        scheduleId: 'integration-1',
        traceId: 'trace-integration-1',
        agentId: 'minimal-engineer',
        task: 'bounded cancellation integration',
        attempts: 1,
        maxAttempts: 3,
        retryDelayMs: 15_000
      }];
    },
    async complete(scheduleId) {
      events.push(['store.complete', scheduleId]);
    },
    async fail(scheduleId, payload) {
      events.push(['store.fail', scheduleId, payload]);
    },
    async defer(scheduleId, payload) {
      events.push(['store.defer', scheduleId, payload]);
    }
  };

  const worker = createScheduleWorker({
    store,
    registry,
    now: fixedNow,
    executeAgentTask: runtime.executeAgentTask
  });

  return { worker, events, started };
}

async function testCancellationFlowsAcrossWorkerAndLeaseGuard() {
  const { worker, events, started } = buildHarness();
  const controller = new AbortController();
  const pending = worker.runDue({ signal: controller.signal });
  await started;
  controller.abort('shutdown');
  const result = await pending;

  assert.equal(result.claimed, 1);
  assert.equal(result.cancelled, true);
  assert.equal(result.results[0].error, WORKER_CANCELLED_ERROR);
  assert.equal(result.results[0].attemptRefunded, true);
  assert.equal(result.results[0].retryAt, '2026-08-18T05:00:15.000Z');

  assert.ok(events.some(([name]) => name === 'executor.abort'));
  assert.ok(events.some(([name]) => name === 'lease.release'));
  assert.ok(events.some(([name]) => name === 'store.defer'));
  assert.equal(events.some(([name]) => name === 'lease.complete'), false);
  assert.equal(events.some(([name]) => name === 'store.complete'), false);
  assert.equal(events.some(([name]) => name === 'store.fail'), false);

  const releaseIndex = events.findIndex(([name]) => name === 'lease.release');
  const deferIndex = events.findIndex(([name]) => name === 'store.defer');
  assert.ok(releaseIndex >= 0 && deferIndex > releaseIndex);
}

async function testLateSuccessfulExecutorCannotCompleteAfterCancellation() {
  const events = [];
  const controller = new AbortController();
  const runtime = createScheduleExecutionRuntime({
    executor: {
      configured: true,
      async executeAgentTask() {
        controller.abort('finish-race');
        return { ok: true, content: 'late-success' };
      }
    }
  });
  const store = {
    async claimDue() {
      return [{
        scheduleId: 'integration-2',
        traceId: 'trace-integration-2',
        agentId: 'minimal-engineer',
        task: 'completion race',
        attempts: 1,
        maxAttempts: 2,
        retryDelayMs: 10_000
      }];
    },
    async complete(id) { events.push(['complete', id]); },
    async fail(id, payload) { events.push(['fail', id, payload]); },
    async defer(id, payload) { events.push(['defer', id, payload]); }
  };
  const worker = createScheduleWorker({ store, registry, now: fixedNow, executeAgentTask: runtime.executeAgentTask });
  const result = await worker.runDue({ signal: controller.signal });

  assert.equal(result.results[0].error, WORKER_CANCELLED_ERROR);
  assert.equal(result.results[0].attemptRefunded, true);
  assert.equal(events.some(([name]) => name === 'complete'), false);
  assert.deepEqual(events[0], [
    'defer',
    'integration-2',
    { error: WORKER_CANCELLED_ERROR, runAt: '2026-08-18T05:00:10.000Z' }
  ]);
}

await testCancellationFlowsAcrossWorkerAndLeaseGuard();
await testLateSuccessfulExecutorCannotCompleteAfterCancellation();

process.stdout.write('schedule cancellation integration tests passed\n');
