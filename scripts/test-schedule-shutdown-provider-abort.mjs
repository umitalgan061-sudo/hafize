import assert from 'node:assert/strict';
import { createScheduleWorker } from '../lib/schedule-worker.mjs';
import { createScheduleExecutionRuntime } from '../lib/schedule-execution-runtime.mjs';
import { createScheduledAgentExecutor } from '../lib/scheduled-agent-executor.mjs';
import { createScheduledNvidiaCompletion } from '../lib/scheduled-nvidia-completion.mjs';

const registry = {
  agents: [{ id: 'minimal-engineer', name: 'Minimal Engineer', kind: 'selector', toolPolicy: { default: 'deny', allow: [] } }]
};
const agent = registry.agents[0];
const schedule = {
  scheduleId: 'schedule-shutdown-1',
  traceId: 'trace-shutdown-1',
  agentId: agent.id,
  task: 'Shutdown cancellation test',
  attempts: 1,
  maxAttempts: 3,
  retryDelayMs: 60_000
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

let providerSignal = null;
let providerStartedResolve;
const providerStarted = new Promise((resolve) => { providerStartedResolve = resolve; });
const complete = createScheduledNvidiaCompletion({
  timeoutMs: 60_000,
  async complete(_payload, signal) {
    providerSignal = signal;
    providerStartedResolve();
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
const execution = createScheduleExecutionRuntime({ executor });

const deferred = [];
let completeCalls = 0;
let failCalls = 0;
const store = {
  async claimDue({ limit }) {
    assert.equal(limit >= 1, true);
    return [schedule];
  },
  async complete() {
    completeCalls += 1;
  },
  async fail() {
    failCalls += 1;
  },
  async defer(scheduleId, input) {
    deferred.push({ scheduleId, ...input });
  }
};
const worker = createScheduleWorker({
  store,
  registry,
  executeAgentTask: execution.executeAgentTask,
  now: () => new Date('2026-08-18T06:00:00.000Z')
});

const shutdownController = new AbortController();
const pending = worker.runDue({ signal: shutdownController.signal });
await providerStarted;
assert.equal(providerSignal?.aborted, false);
shutdownController.abort(new Error('process shutdown'));
const result = await pending;

assert.equal(providerSignal.aborted, true);
assert.equal(result.claimed, 1);
assert.equal(result.cancelled, true);
assert.equal(result.results.length, 1);
assert.equal(result.results[0].ok, false);
assert.equal(result.results[0].error, 'SCHEDULE_EXECUTION_CANCELLED');
assert.equal(result.results[0].attemptRefunded, true);
assert.equal(completeCalls, 0);
assert.equal(failCalls, 0);
assert.equal(deferred.length, 1);
assert.equal(deferred[0].scheduleId, schedule.scheduleId);
assert.equal(deferred[0].error, 'SCHEDULE_EXECUTION_CANCELLED');
assert.match(deferred[0].runAt, /^2026-08-18T06:01:00\.000Z$/);

process.stdout.write('schedule shutdown to provider abort chain passed\n');
