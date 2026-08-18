import assert from 'node:assert/strict';
import { createScheduleWorker } from '../lib/schedule-worker.mjs';
import { createScheduledAgentExecutor } from '../lib/scheduled-agent-executor.mjs';
import { createScheduledNvidiaCompletion } from '../lib/scheduled-nvidia-completion.mjs';

const registry = {
  agents: [{ id: 'minimal-engineer', name: 'Minimal Engineer', kind: 'selector', toolPolicy: { default: 'deny', allow: [] } }]
};
const agent = registry.agents[0];
const schedule = {
  scheduleId: 'schedule-timeout-1',
  traceId: 'trace-timeout-worker-1',
  agentId: agent.id,
  task: 'Timeout retry policy test',
  attempts: 1,
  maxAttempts: 3,
  retryDelayMs: 300_000
};

function waitForAbort(signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason || new Error('aborted'));
      return;
    }
    signal.addEventListener('abort', () => reject(signal.reason || new Error('aborted')), { once: true });
  });
}

let providerCalls = 0;
const complete = createScheduledNvidiaCompletion({
  timeoutMs: 10_000,
  createAbortRuntime() {
    const controller = new AbortController();
    queueMicrotask(() => controller.abort(new Error('deadline')));
    return {
      signal: controller.signal,
      dispose() {},
      isTimedOut() { return true; }
    };
  },
  async complete(_payload, signal) {
    providerCalls += 1;
    return waitForAbort(signal);
  }
});
const executor = createScheduledAgentExecutor({
  registry,
  model: 'nvidia/test-model',
  nvidiaConfigured: true,
  complete,
  async runAgentTask({ complete: runComplete, signal }) {
    await runComplete({ model: 'nvidia/test-model', messages: [] }, signal);
    return { ok: true, content: 'unexpected' };
  }
});

const failed = [];
const deferred = [];
let completed = 0;
const store = {
  async claimDue() { return [schedule]; },
  async complete() { completed += 1; },
  async fail(scheduleId, input) { failed.push({ scheduleId, ...input }); },
  async defer(scheduleId, input) { deferred.push({ scheduleId, ...input }); }
};
const worker = createScheduleWorker({
  store,
  registry,
  executeAgentTask: executor.executeAgentTask,
  now: () => new Date('2026-08-18T06:00:00.000Z')
});
const result = await worker.runDue();

assert.equal(providerCalls, 1);
assert.equal(result.claimed, 1);
assert.equal(result.cancelled, false);
assert.equal(result.results.length, 1);
assert.equal(result.results[0].ok, false);
assert.equal(result.results[0].error, 'SCHEDULE_AGENT_RUN_TIMEOUT');
assert.equal(result.results[0].retryScheduled, true);
assert.equal(result.results[0].attemptRefunded, undefined);
assert.equal(completed, 0);
assert.equal(deferred.length, 0);
assert.equal(failed.length, 1);
assert.equal(failed[0].scheduleId, schedule.scheduleId);
assert.equal(failed[0].error, 'SCHEDULE_AGENT_RUN_TIMEOUT');
assert.equal(failed[0].retryAt, '2026-08-18T06:05:00.000Z');

process.stdout.write('scheduled NVIDIA timeout retry policy passed\n');
