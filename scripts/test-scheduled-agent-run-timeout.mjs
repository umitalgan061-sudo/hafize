import assert from 'node:assert/strict';
import { createScheduledAgentExecutor, thrownRunError } from '../lib/scheduled-agent-executor.mjs';

const agent = {
  id: 'agency-code-reviewer',
  name: 'Code Reviewer',
  kind: 'specialist',
  description: 'Salt-okunur kod inceleme ajanı.',
  toolPolicy: { default: 'deny', allow: ['repo.read'] }
};
const registry = { agents: [agent] };

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

{
  assert.throws(
    () => createScheduledAgentExecutor({
      registry,
      model: 'mock-model',
      complete: async () => ({ choices: [] }),
      runTimeoutMs: 0
    }),
    /INVALID_SCHEDULE_AGENT_EXECUTOR:runTimeoutMs/
  );
  assert.throws(
    () => createScheduledAgentExecutor({
      registry,
      model: 'mock-model',
      complete: async () => ({ choices: [] }),
      runTimeoutMs: 300_001
    }),
    /INVALID_SCHEDULE_AGENT_EXECUTOR:runTimeoutMs/
  );
}

{
  const signals = [];
  const executor = createScheduledAgentExecutor({
    registry,
    model: 'mock-model',
    runTimeoutMs: 20,
    complete: async (_payload, signal) => {
      signals.push(signal);
      return new Promise(() => {});
    }
  });

  assert.equal(executor.runTimeoutMs, 20);
  const startedAt = Date.now();
  const result = await executor.executeAgentTask({
    traceId: 'trace-schedule-timeout-model',
    agent,
    task: 'Uzun model çağrısı.'
  });
  const elapsed = Date.now() - startedAt;

  assert.equal(result.ok, false);
  assert.equal(result.error, 'SCHEDULE_AGENT_RUN_TIMEOUT');
  assert.equal(signals.length, 1);
  assert.equal(signals[0].aborted, true, 'model completion must receive the bounded run signal');
  assert.ok(elapsed < 1000, `timeout should settle promptly, got ${elapsed}ms`);
  const root = result.taskLedger.entries.find((entry) => entry.action === 'schedule.run');
  assert.ok(root);
  assert.equal(root.status, 'failed');
  assert.equal(root.detail, 'SCHEDULE_AGENT_RUN_TIMEOUT');
}

{
  let receivedSignal = null;
  const executor = createScheduledAgentExecutor({
    registry,
    model: 'mock-model',
    runTimeoutMs: 15,
    complete: async () => ({ choices: [] }),
    runAgentTask: async ({ signal }) => {
      receivedSignal = signal;
      return new Promise(() => {});
    }
  });

  const startedAt = Date.now();
  const result = await executor.executeAgentTask({
    traceId: 'trace-schedule-timeout-ignored-abort',
    agent,
    task: 'Abort sinyalini dinlemeyen işi sınırla.'
  });
  const elapsed = Date.now() - startedAt;

  assert.equal(receivedSignal?.aborted, true);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'SCHEDULE_AGENT_RUN_TIMEOUT');
  assert.ok(elapsed < 1000, `executor must settle even when child ignores abort, got ${elapsed}ms`);
  const root = result.taskLedger.entries.find((entry) => entry.action === 'schedule.run');
  assert.equal(root.status, 'failed');
  assert.equal(root.detail, 'SCHEDULE_AGENT_RUN_TIMEOUT');
}

{
  let receivedSignal = null;
  let lateFinished = false;
  const executor = createScheduledAgentExecutor({
    registry,
    model: 'mock-model',
    runTimeoutMs: 15,
    complete: async () => ({ choices: [] }),
    runAgentTask: async ({ signal }) => {
      receivedSignal = signal;
      await new Promise((resolve) => {
        signal.addEventListener('abort', () => resolve(), { once: true });
      });
      await delay(5);
      lateFinished = true;
      return { ok: true, content: 'late success' };
    }
  });

  const result = await executor.executeAgentTask({
    traceId: 'trace-schedule-timeout-late-success',
    agent,
    task: 'Geç başarıyı reddet.'
  });

  assert.equal(receivedSignal?.aborted, true);
  assert.equal(lateFinished, false, 'executor should not wait for work that continues after timeout');
  assert.equal(result.ok, false, 'a task resolving successfully after timeout must remain failed');
  assert.equal(result.error, 'SCHEDULE_AGENT_RUN_TIMEOUT');
  assert.equal(result.content, undefined);
  const root = result.taskLedger.entries.find((entry) => entry.action === 'schedule.run');
  assert.equal(root.status, 'failed');
  assert.equal(root.detail, 'SCHEDULE_AGENT_RUN_TIMEOUT');
  await delay(20);
  assert.equal(lateFinished, true, 'cooperative child may finish cleanup after the caller already received timeout');
  assert.equal(result.ok, false, 'late completion must not mutate the settled timeout result');
}

{
  const caller = new AbortController();
  const executor = createScheduledAgentExecutor({
    registry,
    model: 'mock-model',
    runTimeoutMs: 500,
    complete: async (_payload, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error('caller aborted');
        error.code = 'CALLER_ABORT';
        reject(error);
      }, { once: true });
    })
  });

  const pending = executor.executeAgentTask({
    traceId: 'trace-schedule-caller-abort',
    agent,
    task: 'Kullanıcı iptali.',
    signal: caller.signal
  });
  setTimeout(() => caller.abort(), 10);
  const result = await pending;

  assert.equal(result.ok, false);
  assert.equal(result.error, 'SCHEDULE_AGENT_RUN_CANCELLED', 'caller abort must not be mislabeled as timeout');
  const root = result.taskLedger.entries.find((entry) => entry.action === 'schedule.run');
  assert.equal(root.status, 'failed');
  assert.equal(root.detail, 'SCHEDULE_AGENT_RUN_CANCELLED');
}

{
  const caller = new AbortController();
  caller.abort();
  let runCalled = false;
  const executor = createScheduledAgentExecutor({
    registry,
    model: 'mock-model',
    runTimeoutMs: 25,
    complete: async () => ({ choices: [] }),
    runAgentTask: async () => {
      runCalled = true;
      return { ok: true, content: 'unexpected' };
    }
  });

  const result = await executor.executeAgentTask({
    traceId: 'trace-schedule-pre-abort',
    agent,
    task: 'Başlamadan iptal.',
    signal: caller.signal
  });
  assert.deepEqual(result, { ok: false, error: 'SCHEDULE_AGENT_RUN_CANCELLED' });
  assert.equal(runCalled, false);
}

{
  assert.equal(
    thrownRunError(Object.assign(new Error('cancel-like'), { code: 'SCHEDULE_AGENT_RUN_TIMEOUT' }), null, true),
    'SCHEDULE_AGENT_RUN_TIMEOUT'
  );
  const caller = new AbortController();
  caller.abort();
  assert.equal(
    thrownRunError(Object.assign(new Error('timeout'), { code: 'SCHEDULE_AGENT_RUN_TIMEOUT' }), caller.signal, false),
    'SCHEDULE_AGENT_RUN_CANCELLED',
    'explicit caller cancellation keeps precedence unless the bounded runtime actually timed out'
  );
}

console.log('scheduled agent run timeout tests passed');
