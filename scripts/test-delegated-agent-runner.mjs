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

const ledger = createAgentRunLedger({ traceId: 'trace-1', agentId: primary.id });
const delegation = ledger.recordDelegationStart(reviewer.id);
const payloads = [];
const result = await runDelegatedAgent({
  agent: reviewer,
  task: 'README dosyasını incele.',
  traceId: 'trace-1',
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
        choices: [{
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
    return { choices: [{ message: { role: 'assistant', content: 'İnceleme tamamlandı.' } }] };
  }
});

assert.deepEqual(result, { ok: true, content: 'İnceleme tamamlandı.' });
const toolEntry = ledger.snapshot().entries.find((entry) => entry.action === 'tool:github_read_file');
assert.equal(toolEntry.agentId, reviewer.id);
assert.equal(toolEntry.parentTaskId, delegation.taskId);
assert.equal(toolEntry.status, 'completed');

const noToolsPayloads = [];
const noTools = await runDelegatedAgent({
  agent: reviewer,
  task: 'Kısa incele.',
  traceId: 'trace-2',
  parentTaskId: 'task_parent',
  registry,
  runLedger: createAgentRunLedger({ traceId: 'trace-2', agentId: primary.id }),
  model: 'mock-model',
  githubReadConfigured: false,
  complete: async (payload) => {
    noToolsPayloads.push(payload);
    return { choices: [{ message: { role: 'assistant', content: 'toolsuz' } }] };
  }
});

assert.deepEqual(noTools, { ok: true, content: 'toolsuz' });
assert.equal('tools' in noToolsPayloads[0], false);

console.log('delegated agent runner tests passed');
