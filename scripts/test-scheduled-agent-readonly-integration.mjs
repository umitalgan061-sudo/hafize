import assert from 'node:assert/strict';
import { createScheduledAgentExecutor } from '../lib/scheduled-agent-executor.mjs';

const primary = {
  id: 'hafize-general',
  name: 'Hafize',
  kind: 'primary',
  description: 'Ana ajan.',
  toolPolicy: {
    default: 'deny',
    allow: ['runtime.status', 'agent.delegate']
  }
};
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
const registry = { agents: [primary, reviewer] };

{
  const payloads = [];
  const reads = [];
  const executor = createScheduledAgentExecutor({
    registry,
    model: 'mock-model',
    nvidiaConfigured: true,
    githubReadConfigured: true,
    githubReadFile: async (args) => {
      reads.push(args);
      return { content: '# Hafize', truncated: false };
    },
    complete: async (payload) => {
      payloads.push(payload);
      if (payloads.length === 1) {
        assert.deepEqual(
          payload.tools.map((tool) => tool.function.name),
          ['github_read_file'],
          'scheduled reviewer must receive only its backend-authorized read tool'
        );
        assert.equal(payload.tool_choice, 'auto');
        return {
          choices: [{
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: 'schedule_read_1',
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

      assert.equal(payload.tool_choice, 'none', 'tool recursion must be disabled after execution');
      assert.equal(payload.messages.at(-1).role, 'tool');
      assert.match(payload.messages.at(-1).content, /# Hafize/);
      return { choices: [{ message: { role: 'assistant', content: 'Salt-okunur inceleme tamamlandı.' } }] };
    }
  });

  const result = await executor.executeAgentTask({
    traceId: 'trace-schedule-readonly',
    agent: { id: reviewer.id, injectedToolPolicy: { allow: ['repo.merge'] } },
    task: ' README dosyasını incele. '
  });

  assert.equal(result.ok, true);
  assert.equal(result.content, 'Salt-okunur inceleme tamamlandı.');
  assert.deepEqual(reads, [{ repository: 'umitalgan061-sudo/hafize', path: 'README.md' }]);
  assert.equal(result.taskLedger.traceId, 'trace-schedule-readonly');
  const root = result.taskLedger.entries.find((entry) => entry.action === 'schedule.run');
  const tool = result.taskLedger.entries.find((entry) => entry.action === 'tool:github_read_file');
  assert.ok(root);
  assert.ok(tool);
  assert.equal(root.agentId, reviewer.id, 'caller-supplied agent fields must not replace canonical registry identity');
  assert.equal(root.status, 'completed');
  assert.equal(tool.agentId, reviewer.id);
  assert.equal(tool.parentTaskId, root.taskId, 'tool ledger entry must stay under the schedule root task');
  assert.equal(tool.status, 'completed');
}

{
  const payloads = [];
  let readCalled = false;
  const executor = createScheduledAgentExecutor({
    registry,
    model: 'mock-model',
    githubReadConfigured: true,
    githubReadFile: async () => {
      readCalled = true;
      return { content: 'unexpected' };
    },
    complete: async (payload) => {
      payloads.push(payload);
      if (payloads.length === 1) {
        assert.deepEqual(payload.tools.map((tool) => tool.function.name), ['github_read_file']);
        return {
          choices: [{
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [{
                id: 'schedule_write_attempt',
                type: 'function',
                function: {
                  name: 'github_merge_pull_request',
                  arguments: JSON.stringify({ repository: 'umitalgan061-sudo/hafize', pullNumber: 1 })
                }
              }]
            }
          }]
        };
      }

      assert.equal(payload.tool_choice, 'none');
      assert.match(payload.messages.at(-1).content, /UNKNOWN_TOOL/);
      return { choices: [{ message: { role: 'assistant', content: 'Yazma isteği uygulanmadı.' } }] };
    }
  });

  const result = await executor.executeAgentTask({
    traceId: 'trace-schedule-write-denied',
    agent: reviewer,
    task: 'PR birleştir.'
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'DELEGATED_TOOL_FAILED');
  assert.equal(readCalled, false, 'unknown/write-like tool call must not fall through to an available read executor');
  const root = result.taskLedger.entries.find((entry) => entry.action === 'schedule.run');
  const attempted = result.taskLedger.entries.find((entry) => entry.action === 'tool:github_merge_pull_request');
  assert.ok(root);
  assert.ok(attempted, 'denied/unknown call must still be auditable in the task ledger');
  assert.equal(attempted.parentTaskId, root.taskId);
  assert.equal(attempted.status, 'failed');
  assert.equal(attempted.detail, 'UNKNOWN_TOOL');
  assert.equal(root.status, 'failed');
  assert.equal(root.detail, 'DELEGATED_TOOL_FAILED');
}

{
  const payloads = [];
  const executor = createScheduledAgentExecutor({
    registry,
    model: 'mock-model',
    githubReadConfigured: false,
    complete: async (payload) => {
      payloads.push(payload);
      return { choices: [{ message: { role: 'assistant', content: 'Tool yok.' } }] };
    }
  });

  const result = await executor.executeAgentTask({
    traceId: 'trace-schedule-no-github',
    agent: reviewer,
    task: 'Repo oku.'
  });
  assert.equal(result.ok, true);
  assert.equal('tools' in payloads[0], false, 'unconfigured GitHub read capability must not be advertised to the model');
  assert.equal('tool_choice' in payloads[0], false);
}

console.log('scheduled agent readonly integration tests passed');
