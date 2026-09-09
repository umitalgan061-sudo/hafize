import assert from 'node:assert/strict';
import { createAgentRunLedger } from '../lib/agent-run-ledger.mjs';
import { runDelegatedAgent } from '../lib/delegated-agent-runner.mjs';

const reviewer = {
  id: 'agency-code-reviewer',
  name: 'Code Reviewer',
  kind: 'specialist',
  description: 'Salt-okunur inceleme ajanı.',
  toolPolicy: {
    default: 'deny',
    allow: ['repo.read'],
    deny: ['repo.write_branch', 'repo.merge']
  }
};
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
const registry = { agents: [primary, reviewer] };

const ledger = createAgentRunLedger({ traceId: 'trace-delegated-1', agentId: primary.id });
const delegation = ledger.recordDelegationStart(reviewer.id);
const payloads = [];
const result = await runDelegatedAgent({
  agent: reviewer,
  task: 'README dosyasını incele.',
  traceId: 'trace-delegated-1',
  parentTaskId: delegation.taskId,
  registry,
  runLedger: ledger,
  model: 'mock-model',
  githubReadConfigured: true,
  githubReadFile: async (args) => ({ ...args, content: '# Hafize', truncated: false }),
  complete: async (payload) => {
    payloads.push(payload);
    if (payloads.length === 1) {
      assert.deepEqual(payload.tools.map((tool) => tool.function.name), ['github_read_file']);
      assert.equal(payload.tools.some((tool) => tool.function.name === 'runtime_status'), false);
      assert.equal(payload.tools.some((tool) => tool.function.name === 'agent_delegate'), false);
      return {
        id: 'resp-1',
        model: 'mock-model',
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        choices: [{
          finish_reason: 'tool_calls',
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_1',
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

    assert.equal(payload.tool_choice, 'none');
    assert.equal(payload.messages.at(-1).role, 'tool');
    assert.match(payload.messages.at(-1).content, /# Hafize/);
    return {
      id: 'resp-2',
      model: 'mock-model',
      choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'İnceleme tamamlandı.' } }]
    };
  }
});

assert.deepEqual(result, { ok: true, content: 'İnceleme tamamlandı.' });
const toolEntry = ledger.snapshot().entries.find((entry) => entry.action === 'tool:github_read_file');
assert.equal(toolEntry.agentId, reviewer.id);
assert.equal(toolEntry.parentTaskId, delegation.taskId);
assert.equal(toolEntry.status, 'completed');

const invalidFirst = await runDelegatedAgent({
  agent: reviewer,
  task: 'Hatalı model cevabını doğrula.',
  traceId: 'trace-delegated-3',
  parentTaskId: 'task_parent',
  registry,
  runLedger: createAgentRunLedger({ traceId: 'trace-delegated-3', agentId: primary.id }),
  model: 'mock-model',
  complete: async () => ({
    choices: [{
      finish_reason: 'tool_calls',
      message: {
        role: 'assistant',
        tool_calls: [{
          id: 'oversized',
          function: { name: 'github_read_file', arguments: 'x'.repeat(16_385) }
        }]
      }
    }]
  })
});
assert.deepEqual(invalidFirst, { ok: false, error: 'INVALID_NVIDIA_RESPONSE' });

const noToolsPayloads = [];
const noTools = await runDelegatedAgent({
  agent: reviewer,
  task: 'Kısa incele.',
  traceId: 'trace-delegated-2',
  parentTaskId: 'task_parent',
  registry,
  runLedger: createAgentRunLedger({ traceId: 'trace-delegated-2', agentId: primary.id }),
  model: 'mock-model',
  githubReadConfigured: false,
  complete: async (payload) => {
    noToolsPayloads.push(payload);
    return {
      choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'toolsuz' } }]
    };
  }
});

assert.deepEqual(noTools, { ok: true, content: 'toolsuz' });
assert.equal('tools' in noToolsPayloads[0], false);

console.log('delegated agent runner tests passed');
