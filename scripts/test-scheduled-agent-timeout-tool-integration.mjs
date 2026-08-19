import assert from 'node:assert/strict';
import { createScheduledAgentExecutor } from '../lib/scheduled-agent-executor.mjs';

const reviewer = {
  id: 'agency-code-reviewer',
  name: 'Code Reviewer',
  kind: 'specialist',
  description: 'Salt-okunur kod inceleme ajanı.',
  toolPolicy: {
    default: 'deny',
    allow: ['repo.read'],
    deny: ['repo.write_branch', 'repo.merge']
  }
};
const registry = { agents: [reviewer] };

{
  let completionCalls = 0;
  let readCalls = 0;
  const executor = createScheduledAgentExecutor({
    registry,
    model: 'mock-model',
    runTimeoutMs: 20,
    githubReadConfigured: true,
    githubReadFile: async () => {
      readCalls += 1;
      return new Promise(() => {});
    },
    complete: async (payload) => {
      completionCalls += 1;
      if (completionCalls !== 1) {
        throw new Error('second completion must not run after timeout');
      }
      assert.deepEqual(payload.tools.map((tool) => tool.function.name), ['github_read_file']);
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'timeout_read_1',
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

  const startedAt = Date.now();
  const result = await executor.executeAgentTask({
    traceId: 'trace-schedule-tool-timeout',
    agent: reviewer,
    task: 'README dosyasını incele.'
  });
  const elapsed = Date.now() - startedAt;

  assert.equal(result.ok, false);
  assert.equal(result.error, 'SCHEDULE_AGENT_RUN_TIMEOUT');
  assert.equal(readCalls, 1);
  assert.equal(completionCalls, 1);
  assert.ok(elapsed < 1000, `tool timeout must settle the schedule promptly, got ${elapsed}ms`);
  const root = result.taskLedger.entries.find((entry) => entry.action === 'schedule.run');
  assert.ok(root);
  assert.equal(root.status, 'failed');
  assert.equal(root.detail, 'SCHEDULE_AGENT_RUN_TIMEOUT');
}

{
  let readCalls = 0;
  const executor = createScheduledAgentExecutor({
    registry,
    model: 'mock-model',
    runTimeoutMs: 20,
    githubReadConfigured: true,
    githubReadFile: async () => {
      readCalls += 1;
      return { content: '# Hafize', truncated: false };
    },
    complete: async (payload) => {
      if (!payload.messages.some((message) => message.role === 'tool')) {
        return {
          choices: [{
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: 'fast_read_1',
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
      return { choices: [{ message: { role: 'assistant', content: 'Tamamlandı.' } }] };
    }
  });

  const result = await executor.executeAgentTask({
    traceId: 'trace-schedule-tool-fast',
    agent: reviewer,
    task: 'Hızlı okuma.'
  });

  assert.equal(result.ok, true);
  assert.equal(result.content, 'Tamamlandı.');
  assert.equal(readCalls, 1, 'bounded schedule policy must not break a normal read-only tool run');
  const root = result.taskLedger.entries.find((entry) => entry.action === 'schedule.run');
  const tool = result.taskLedger.entries.find((entry) => entry.action === 'tool:github_read_file');
  assert.equal(root.status, 'completed');
  assert.equal(tool.status, 'completed');
  assert.equal(tool.parentTaskId, root.taskId);
}

console.log('scheduled agent timeout + real delegated tool integration tests passed');
