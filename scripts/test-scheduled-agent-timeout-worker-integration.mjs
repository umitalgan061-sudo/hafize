import assert from 'node:assert/strict';
import { createScheduleWorker } from '../lib/schedule-worker.mjs';
import { createScheduledAgentExecutor } from '../lib/scheduled-agent-executor.mjs';

const agent = {
  id: 'agency-code-reviewer',
  name: 'Code Reviewer',
  kind: 'specialist',
  description: 'Salt-okunur kod inceleme ajanı.',
  toolPolicy: { default: 'deny', allow: ['repo.read'] }
};
const registry = { agents: [agent] };

function schedule({ attempts, maxAttempts }) {
  return {
    scheduleId: `schedule-timeout-${attempts}-${maxAttempts}`,
    traceId: `trace-timeout-${attempts}-${maxAttempts}`,
    agentId: agent.id,
    task: 'Timeout davranışını doğrula.',
    attempts,
    maxAttempts,
    retryDelayMs: 5_000
  };
}

function createStore(claimed) {
  const events = [];
  return {
    events,
    async claimDue({ limit }) {
      events.push(['claimDue', limit]);
      return [claimed];
    },
    async complete(scheduleId) {
      events.push(['complete', scheduleId]);
    },
    async fail(scheduleId, detail) {
      events.push(['fail', scheduleId, detail]);
    },
    async defer(scheduleId, detail) {
      events.push(['defer', scheduleId, detail]);
    }
  };
}

function createTimeoutExecutor() {
  return createScheduledAgentExecutor({
    registry,
    model: 'mock-model',
    runTimeoutMs: 15,
    complete: async () => new Promise(() => {})
  });
}

{
  const claimed = schedule({ attempts: 1, maxAttempts: 2 });
  const store = createStore(claimed);
  const executor = createTimeoutExecutor();
  const fixedNow = new Date('2026-08-20T00:00:00.000Z');
  const worker = createScheduleWorker({
    store,
    registry,
    executeAgentTask: executor.executeAgentTask,
    now: () => fixedNow,
    maxBatch: 1,
    maxConcurrency: 1
  });

  const run = await worker.runDue();
  assert.equal(run.claimed, 1);
  assert.equal(run.results.length, 1);
  assert.deepEqual(run.results[0], {
    scheduleId: claimed.scheduleId,
    ok: false,
    error: 'SCHEDULE_AGENT_RUN_TIMEOUT',
    retryScheduled: true
  });

  const fail = store.events.find(([name]) => name === 'fail');
  assert.deepEqual(fail, [
    'fail',
    claimed.scheduleId,
    {
      error: 'SCHEDULE_AGENT_RUN_TIMEOUT',
      retryAt: '2026-08-20T00:00:05.000Z'
    }
  ]);
  assert.equal(store.events.some(([name]) => name === 'complete'), false);
  assert.equal(store.events.some(([name]) => name === 'defer'), false);
}

{
  const claimed = schedule({ attempts: 2, maxAttempts: 2 });
  const store = createStore(claimed);
  const executor = createTimeoutExecutor();
  const worker = createScheduleWorker({
    store,
    registry,
    executeAgentTask: executor.executeAgentTask,
    now: () => new Date('2026-08-20T00:00:00.000Z'),
    maxBatch: 1,
    maxConcurrency: 1
  });

  const run = await worker.runDue();
  assert.deepEqual(run.results[0], {
    scheduleId: claimed.scheduleId,
    ok: false,
    error: 'SCHEDULE_AGENT_RUN_TIMEOUT',
    retryScheduled: false
  });

  const fail = store.events.find(([name]) => name === 'fail');
  assert.deepEqual(fail, [
    'fail',
    claimed.scheduleId,
    { error: 'SCHEDULE_AGENT_RUN_TIMEOUT' }
  ]);
  assert.equal(store.events.some(([name]) => name === 'complete'), false);
  assert.equal(store.events.some(([name]) => name === 'defer'), false);
}

console.log('scheduled agent timeout + worker retry integration tests passed');
