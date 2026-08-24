import assert from 'node:assert/strict';
import { createScheduleExecutionRuntime } from '../lib/schedule-execution-runtime.mjs';
import { createScheduleWorker } from '../lib/schedule-worker.mjs';

const agent = {
  id: 'agency-code-reviewer',
  name: 'Code Reviewer',
  kind: 'specialist',
  description: 'Read-only reviewer fixture.',
  toolPolicy: { default: 'deny', allow: ['repo.read'] }
};
const registry = { agents: [agent] };
const claimed = {
  scheduleId: 'schedule_success_runtime_worker',
  traceId: 'trace_success_runtime_worker',
  agentId: agent.id,
  task: 'Read-only scheduled review.',
  attempts: 1,
  maxAttempts: 1,
  retryDelayMs: 5_000
};

const leaseEvents = [];
const lease = {
  leaseMs: 10_000,
  async acquire(scheduleId) {
    leaseEvents.push(['acquire', scheduleId]);
    return { status: 'acquired', fence: 7 };
  },
  async renew({ scheduleId, fence }) {
    leaseEvents.push(['renew', scheduleId, fence]);
    return { status: 'renewed' };
  },
  async complete({ scheduleId, fence }) {
    leaseEvents.push(['complete', scheduleId, fence]);
    return { status: 'completed' };
  },
  async release({ scheduleId, fence }) {
    leaseEvents.push(['release', scheduleId, fence]);
    return { status: 'released' };
  }
};

const executorCalls = [];
const executor = {
  configured: true,
  async executeAgentTask(input) {
    executorCalls.push(input);
    return {
      ok: true,
      content: 'Private scheduled model output must not become worker state.',
      taskLedger: {
        traceId: input.traceId,
        entries: [{ taskId: 'task-root', status: 'completed' }]
      }
    };
  }
};

const runtime = createScheduleExecutionRuntime({
  executor,
  lease,
  renewIntervalMs: 9_000
});
assert.equal(runtime.configured, true);
assert.equal(runtime.leaseGuarded, true);

const storeEvents = [];
const store = {
  async claimDue({ limit }) {
    storeEvents.push(['claimDue', limit]);
    return [claimed];
  },
  async complete(scheduleId) {
    storeEvents.push(['complete', scheduleId]);
  },
  async fail(scheduleId, detail) {
    storeEvents.push(['fail', scheduleId, detail]);
  },
  async defer(scheduleId, detail) {
    storeEvents.push(['defer', scheduleId, detail]);
  }
};

const worker = createScheduleWorker({
  store,
  registry,
  executeAgentTask: runtime.executeAgentTask,
  maxBatch: 1,
  maxConcurrency: 1,
  now: () => new Date('2026-08-24T17:00:00.000Z')
});

const run = await worker.runDue();
assert.equal(run.claimed, 1);
assert.deepEqual(run.results, [{ scheduleId: claimed.scheduleId, ok: true }]);
assert.equal(executorCalls.length, 1);
assert.equal(executorCalls[0].scheduleId, claimed.scheduleId);
assert.equal(executorCalls[0].traceId, claimed.traceId);
assert.equal(executorCalls[0].agent, agent);
assert.equal(executorCalls[0].task, claimed.task);
assert.equal(executorCalls[0].attempt, 1);
assert.equal(executorCalls[0].signal instanceof AbortSignal, true);

assert.deepEqual(
  leaseEvents.filter(([name]) => name !== 'renew'),
  [
    ['acquire', claimed.scheduleId],
    ['complete', claimed.scheduleId, 7]
  ]
);
assert.equal(leaseEvents.some(([name]) => name === 'release'), false);
assert.deepEqual(
  storeEvents,
  [
    ['claimDue', 1],
    ['complete', claimed.scheduleId]
  ],
  'successful rich executor result must complete the scheduled task exactly once'
);

console.log('schedule success runtime + worker integration tests passed');
