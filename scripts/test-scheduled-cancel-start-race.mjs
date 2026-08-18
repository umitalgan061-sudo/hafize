import assert from 'node:assert/strict';
import { createScheduledAgentExecutor } from '../lib/scheduled-agent-executor.mjs';
import { createScheduledNvidiaCompletion } from '../lib/scheduled-nvidia-completion.mjs';

function createAgent() {
  return {
    id: 'minimal-engineer',
    name: 'Minimal Engineer',
    kind: 'selector',
    toolPolicy: { default: 'deny', allow: [], approvalRequired: [], deny: [] }
  };
}

async function testExecutorStopsProviderBeforeMicrotaskStart() {
  const controller = new AbortController();
  const agent = createAgent();
  let providerCalls = 0;
  let delegatedCalls = 0;

  const executor = createScheduledAgentExecutor({
    registry: { agents: [agent] },
    model: 'test-model',
    complete: async () => {
      providerCalls += 1;
      return { choices: [{ message: { role: 'assistant', content: 'unexpected' } }] };
    },
    runAgentTask: async ({ complete, signal }) => {
      delegatedCalls += 1;
      const pending = complete({ model: 'test-model' }, signal);
      controller.abort(new Error('test cancellation'));
      await pending;
      return { ok: true, content: 'unexpected' };
    }
  });

  const result = await executor.executeAgentTask({
    traceId: 'trace_cancel_start_race',
    agent,
    task: 'Do not start provider after cancellation.',
    signal: controller.signal
  });

  assert.equal(delegatedCalls, 1);
  assert.equal(providerCalls, 0);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'SCHEDULE_AGENT_RUN_CANCELLED');
  assert.equal(result.taskLedger?.traceId, 'trace_cancel_start_race');
}

async function testScheduledCompletionRejectsAbortedRuntimeBeforeProvider() {
  const parent = new AbortController();
  const runtimeController = new AbortController();
  runtimeController.abort(new Error('runtime already cancelled'));
  let providerCalls = 0;
  let disposed = 0;

  const completion = createScheduledNvidiaCompletion({
    timeoutMs: 120_000,
    complete: async () => {
      providerCalls += 1;
      return { ok: true };
    },
    createAbortRuntime: () => ({
      signal: runtimeController.signal,
      isTimedOut: () => false,
      dispose: () => {
        disposed += 1;
        return true;
      }
    })
  });

  await assert.rejects(
    completion({ model: 'test-model' }, parent.signal),
    (error) => error?.code === 'SCHEDULE_AGENT_RUN_CANCELLED'
  );
  assert.equal(providerCalls, 0);
  assert.equal(disposed, 1);
}

async function testTimeoutWinsForPreAbortedTimeoutRuntime() {
  const runtimeController = new AbortController();
  runtimeController.abort(new Error('timeout'));
  let providerCalls = 0;

  const completion = createScheduledNvidiaCompletion({
    timeoutMs: 120_000,
    complete: async () => {
      providerCalls += 1;
      return { ok: true };
    },
    createAbortRuntime: () => ({
      signal: runtimeController.signal,
      isTimedOut: () => true,
      dispose: () => true
    })
  });

  await assert.rejects(
    completion({ model: 'test-model' }),
    (error) => error?.code === 'SCHEDULE_AGENT_RUN_TIMEOUT'
  );
  assert.equal(providerCalls, 0);
}

await testExecutorStopsProviderBeforeMicrotaskStart();
await testScheduledCompletionRejectsAbortedRuntimeBeforeProvider();
await testTimeoutWinsForPreAbortedTimeoutRuntime();
console.log('scheduled cancellation start-race tests passed');
