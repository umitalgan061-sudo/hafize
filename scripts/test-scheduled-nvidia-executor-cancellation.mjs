import assert from 'node:assert/strict';
import { createScheduledAgentExecutor } from '../lib/scheduled-agent-executor.mjs';
import { createScheduledNvidiaCompletion } from '../lib/scheduled-nvidia-completion.mjs';

const registry = {
  agents: [{ id: 'minimal-engineer', name: 'Minimal Engineer', kind: 'selector', toolPolicy: { default: 'deny', allow: [] } }]
};
const agent = registry.agents[0];

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
const complete = createScheduledNvidiaCompletion({
  timeoutMs: 60_000,
  async complete(_payload, signal) {
    providerSignal = signal;
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

const caller = new AbortController();
const pending = executor.executeAgentTask({
  traceId: 'trace-cancel-1',
  agent,
  task: 'Cancellation propagation test',
  signal: caller.signal
});
while (!providerSignal) await new Promise((resolve) => setImmediate(resolve));
assert.equal(providerSignal.aborted, false);
caller.abort(new Error('worker shutdown'));
const cancelled = await pending;
assert.equal(providerSignal.aborted, true);
assert.equal(cancelled.ok, false);
assert.equal(cancelled.error, 'SCHEDULE_AGENT_RUN_CANCELLED');
assert.equal(cancelled.taskLedger?.traceId, 'trace-cancel-1');

const preAborted = new AbortController();
preAborted.abort();
const preResult = await executor.executeAgentTask({
  traceId: 'trace-cancel-2',
  agent,
  task: 'Pre-aborted test',
  signal: preAborted.signal
});
assert.equal(preResult.ok, false);
assert.equal(preResult.error, 'SCHEDULE_AGENT_RUN_CANCELLED');

let providerCalls = 0;
let disposed = 0;
const timeoutComplete = createScheduledNvidiaCompletion({
  timeoutMs: 10_000,
  createAbortRuntime() {
    const controller = new AbortController();
    queueMicrotask(() => controller.abort(new Error('deadline')));
    return {
      signal: controller.signal,
      dispose() { disposed += 1; },
      isTimedOut() { return true; }
    };
  },
  async complete(_payload, signal) {
    providerCalls += 1;
    return waitForAbort(signal);
  }
});
const timeoutExecutor = createScheduledAgentExecutor({
  registry,
  model: 'nvidia/test-model',
  nvidiaConfigured: true,
  complete: timeoutComplete,
  async runAgentTask({ complete: runComplete, signal }) {
    await runComplete({ model: 'nvidia/test-model', messages: [] }, signal);
    return { ok: true, content: 'unexpected' };
  }
});
const timeoutResult = await timeoutExecutor.executeAgentTask({
  traceId: 'trace-timeout-1',
  agent,
  task: 'Timeout classification test'
});
assert.equal(timeoutResult.ok, false);
assert.equal(timeoutResult.error, 'SCHEDULE_AGENT_RUN_TIMEOUT');
assert.equal(timeoutResult.taskLedger?.traceId, 'trace-timeout-1');
assert.equal(providerCalls, 1);
assert.equal(disposed, 1);

process.stdout.write('scheduled NVIDIA executor cancellation chain passed\n');
