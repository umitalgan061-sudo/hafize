import assert from 'node:assert/strict';
import { createScheduledAgentExecutor } from '../lib/scheduled-agent-executor.mjs';
import { runWithScheduleCompletionSignal } from '../lib/schedule-completion-signal.mjs';

const registry = {
  agents: [{ id: 'minimal-engineer', name: 'Minimal Engineer', kind: 'selector' }]
};
const agent = registry.agents[0];

function createHarness({ timeoutMs = 5_000 } = {}) {
  let providerStarted = 0;
  let providerAborted = 0;
  let providerResolved = 0;
  let lastSignal = null;

  const executor = createScheduledAgentExecutor({
    registry,
    model: 'nvidia/test-model',
    nvidiaConfigured: true,
    async complete(payload, parentSignal) {
      return runWithScheduleCompletionSignal({
        parentSignal,
        timeoutMs,
        run(signal) {
          providerStarted += 1;
          lastSignal = signal;
          return new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => {
              providerAborted += 1;
              reject(Object.assign(new Error('PROVIDER_ABORTED'), { name: 'AbortError' }));
            }, { once: true });
            setTimeout(() => {
              providerResolved += 1;
              resolve({ choices: [{ message: { role: 'assistant', content: 'late response' } }] });
            }, 10_000).unref?.();
          });
        }
      });
    },
    async runAgentTask({ signal, complete }) {
      try {
        const output = await complete({ model: 'nvidia/test-model', messages: [] }, signal);
        return { ok: true, content: output?.choices?.[0]?.message?.content || '' };
      } catch (error) {
        return { ok: false, error: error?.name === 'AbortError' ? 'SCHEDULE_AGENT_RUN_CANCELLED' : 'PROVIDER_FAILED' };
      }
    }
  });

  return {
    executor,
    metrics: () => ({ providerStarted, providerAborted, providerResolved, lastSignal })
  };
}

{
  const harness = createHarness();
  const controller = new AbortController();
  const pending = harness.executor.executeAgentTask({
    traceId: 'trace_cancel_1',
    agent,
    task: 'cancel me',
    signal: controller.signal
  });
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(harness.metrics().providerStarted, 1);
  controller.abort('lease_lost');
  const result = await pending;
  assert.equal(result.ok, false);
  assert.equal(result.error, 'SCHEDULE_AGENT_RUN_CANCELLED');
  assert.equal(harness.metrics().providerAborted, 1);
  assert.equal(harness.metrics().providerResolved, 0);
  assert.equal(harness.metrics().lastSignal.aborted, true);
  assert.equal(harness.metrics().lastSignal.reason, 'caller');
}

{
  const harness = createHarness({ timeoutMs: 1_000 });
  const started = Date.now();
  const result = await harness.executor.executeAgentTask({
    traceId: 'trace_timeout_1',
    agent,
    task: 'timeout me'
  });
  const elapsed = Date.now() - started;
  assert.equal(result.ok, false);
  assert.equal(result.error, 'SCHEDULE_AGENT_RUN_FAILED');
  assert.equal(harness.metrics().providerStarted, 1);
  assert.equal(harness.metrics().providerAborted, 1);
  assert.equal(harness.metrics().providerResolved, 0);
  assert.ok(elapsed >= 900 && elapsed < 3_000, `timeout elapsed=${elapsed}`);
}

{
  let completeCalls = 0;
  const executor = createScheduledAgentExecutor({
    registry,
    model: 'nvidia/test-model',
    nvidiaConfigured: true,
    async complete() {
      completeCalls += 1;
      return { choices: [{ message: { role: 'assistant', content: 'unexpected' } }] };
    },
    async runAgentTask({ signal, complete }) {
      await complete({}, signal);
      return { ok: true, content: 'unexpected' };
    }
  });
  const controller = new AbortController();
  controller.abort('shutdown');
  const result = await executor.executeAgentTask({
    traceId: 'trace_preabort_1',
    agent,
    task: 'never start',
    signal: controller.signal
  });
  assert.deepEqual(result, { ok: false, error: 'SCHEDULE_AGENT_RUN_CANCELLED' });
  assert.equal(completeCalls, 0);
}

console.log('scheduled NVIDIA cancellation integration: ok');
