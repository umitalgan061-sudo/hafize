import assert from 'node:assert/strict';
import { createScheduledAgentExecutor } from '../lib/scheduled-agent-executor.mjs';

const reviewer = {
  id: 'agency-code-reviewer',
  name: 'Code Reviewer',
  kind: 'specialist',
  description: 'Salt-okunur kod inceleme ajanı.',
  toolPolicy: { default: 'deny', allow: ['repo.read'] }
};
const registry = { agents: [reviewer] };

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

{
  const modelResponse = deferred();
  let completeCalls = 0;
  const controller = new AbortController();
  const executor = createScheduledAgentExecutor({
    registry,
    model: 'mock-model',
    complete: async (_payload, signal) => {
      completeCalls += 1;
      assert.equal(signal, controller.signal, 'scheduled model call must receive the run signal');
      return modelResponse.promise;
    }
  });

  const pending = executor.executeAgentTask({
    traceId: 'trace-cancel-model',
    agent: reviewer,
    task: 'README dosyasını incele.',
    signal: controller.signal
  });
  await flush();
  assert.equal(completeCalls, 1);
  controller.abort();

  const result = await pending;
  assert.equal(result.ok, false);
  assert.equal(result.error, 'SCHEDULE_AGENT_RUN_CANCELLED');
  assert.equal(result.taskLedger.traceId, 'trace-cancel-model');
  const root = result.taskLedger.entries.find((entry) => entry.action === 'schedule.run');
  assert.ok(root);
  assert.equal(root.status, 'failed');
  assert.equal(root.detail, 'SCHEDULE_AGENT_RUN_CANCELLED');
  assert.equal(result.taskLedger.entries.some((entry) => entry.action.startsWith('tool:')), false);

  modelResponse.resolve({
    choices: [{ message: { role: 'assistant', content: 'Geç gelen başarı sonucu.' } }]
  });
  await flush();
  assert.equal(root.status, 'failed', 'late model completion must not turn a cancelled snapshot into success');
}

{
  const read = deferred();
  const controller = new AbortController();
  let completeCalls = 0;
  let readCalls = 0;
  const executor = createScheduledAgentExecutor({
    registry,
    model: 'mock-model',
    githubReadConfigured: true,
    githubReadFile: async (args) => {
      readCalls += 1;
      assert.deepEqual(args, { repository: 'umitalgan061-sudo/hafize', path: 'README.md' });
      return read.promise;
    },
    complete: async (payload) => {
      completeCalls += 1;
      if (completeCalls > 1) {
        throw new Error('second-model-call-must-not-run-after-cancellation');
      }
      assert.deepEqual(payload.tools.map((tool) => tool.function.name), ['github_read_file']);
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'cancelled_read',
              type: 'function',
              function: {
                name: 'github_read_file',
                arguments: JSON.stringify({
                  repository: 'umitalgan061-sudo/hafize',
                  path: 'README.md'
                })
              }
            }]
          }
        }]
      };
    }
  });

  const pending = executor.executeAgentTask({
    traceId: 'trace-cancel-tool',
    agent: reviewer,
    task: 'README dosyasını incele.',
    signal: controller.signal
  });
  for (let index = 0; index < 8 && readCalls === 0; index += 1) await flush();
  assert.equal(readCalls, 1, 'read tool must have started before cancellation');
  controller.abort();

  const result = await pending;
  assert.equal(result.ok, false);
  assert.equal(result.error, 'SCHEDULE_AGENT_RUN_CANCELLED');
  assert.equal(completeCalls, 1, 'cancelled tool execution must not advance to final model completion');
  const root = result.taskLedger.entries.find((entry) => entry.action === 'schedule.run');
  const tool = result.taskLedger.entries.find((entry) => entry.action === 'tool:github_read_file');
  assert.ok(root);
  assert.ok(tool);
  assert.equal(tool.parentTaskId, root.taskId);
  assert.equal(tool.status, 'failed');
  assert.equal(tool.detail, 'TOOL_EXECUTION_CANCELLED');
  assert.equal(root.status, 'failed');
  assert.equal(root.detail, 'SCHEDULE_AGENT_RUN_CANCELLED');

  read.resolve({ content: 'Geç gelen dosya içeriği.', truncated: false });
  await flush();
  assert.equal(completeCalls, 1, 'late tool completion must stay detached from the cancelled run');
}

{
  const controller = new AbortController();
  controller.abort();
  let completeCalled = false;
  const executor = createScheduledAgentExecutor({
    registry,
    model: 'mock-model',
    complete: async () => {
      completeCalled = true;
      return { choices: [{ message: { role: 'assistant', content: 'unexpected' } }] };
    }
  });

  const result = await executor.executeAgentTask({
    traceId: 'trace-pre-cancelled',
    agent: reviewer,
    task: 'Çalışma.',
    signal: controller.signal
  });
  assert.deepEqual(result, { ok: false, error: 'SCHEDULE_AGENT_RUN_CANCELLED' });
  assert.equal(completeCalled, false, 'pre-aborted run must not create model side effects');
}

{
  const executor = createScheduledAgentExecutor({
    registry,
    model: 'mock-model',
    complete: async () => ({ choices: [{ message: { role: 'assistant', content: 'unexpected' } }] })
  });
  const invalidSignal = { aborted: false };
  const result = await executor.executeAgentTask({
    traceId: 'trace-invalid-signal',
    agent: reviewer,
    task: 'Çalışma.',
    signal: invalidSignal
  });
  assert.deepEqual(result, { ok: false, error: 'INVALID_SCHEDULE_AGENT_TASK' });
}

console.log('scheduled agent cancellation integration tests passed');
