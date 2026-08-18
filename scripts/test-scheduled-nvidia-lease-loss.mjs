import assert from 'node:assert/strict';
import { createScheduleExecutionRuntime } from '../lib/schedule-execution-runtime.mjs';
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

let renewCalls = 0;
let completionCalls = 0;
let releaseCalls = 0;
const lease = {
  leaseMs: 1_000,
  async acquire(scheduleId) {
    assert.equal(scheduleId, 'schedule-lease-loss');
    return { status: 'acquired', fence: 7 };
  },
  async renew({ scheduleId, fence }) {
    assert.equal(scheduleId, 'schedule-lease-loss');
    assert.equal(fence, 7);
    renewCalls += 1;
    return { status: 'stale' };
  },
  async complete() {
    completionCalls += 1;
    return { status: 'completed' };
  },
  async release() {
    releaseCalls += 1;
    return { status: 'released' };
  }
};

const runtime = createScheduleExecutionRuntime({
  executor,
  lease,
  renewIntervalMs: 100
});
const pending = runtime.executeAgentTask({
  scheduleId: 'schedule-lease-loss',
  traceId: 'trace-lease-loss',
  agent,
  task: 'Lease loss should abort the provider request'
});
await providerStarted;
assert.equal(providerSignal.aborted, false);
const result = await pending;
assert.equal(result.ok, false);
assert.equal(result.error, 'SCHEDULE_LEASE_LOST');
assert.equal(providerSignal.aborted, true);
assert.equal(renewCalls >= 1, true);
assert.equal(completionCalls, 0);
assert.equal(releaseCalls, 0);

process.stdout.write('scheduled NVIDIA lease-loss abort chain passed\n');
