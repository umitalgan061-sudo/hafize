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
const orchestrator = {
  id: 'agency-orchestrator',
  name: 'Orchestrator',
  kind: 'specialist',
  description: 'Görevleri uzmanlara bölen orkestratör.',
  toolPolicy: {
    default: 'deny',
    allow: ['agent.delegate'],
    deny: ['repo.merge', 'external.write']
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
const registry = {
  policy: { maxDelegationDepth: 3, maxParallelAgents: 3 },
  agents: [primary, orchestrator, reviewer]
};

const ledger = createAgentRunLedger({ traceId: 'trace-1', agentId: primary.id });
const delegation = ledger.recordDelegationStart(reviewer.id);
const payloads = [];
const result = await runDelegatedAgent({
  agent: reviewer,
  task: 'README dosyasını incele.',
  traceId: 'trace-1',
  parentTaskId: delegation.taskId,
  depth: 1,
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
  depth: 1,
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

const nestedLedger = createAgentRunLedger({ traceId: 'trace-nested', agentId: primary.id });
const outerDelegation = nestedLedger.recordDelegationStart(orchestrator.id);
const nestedPayloads = [];
const nestedResult = await runDelegatedAgent({
  agent: orchestrator,
  task: 'README incelemesini doğru uzmana delege et.',
  traceId: 'trace-nested',
  parentTaskId: outerDelegation.taskId,
  depth: 1,
  registry,
  runLedger: nestedLedger,
  model: 'mock-model',
  githubReadConfigured: true,
  githubReadFile: async (args) => ({ ...args, content: '# Hafize nested', truncated: false }),
  complete: async (payload) => {
    nestedPayloads.push(payload);
    const system = payload.messages[0].content;
    const isReviewer = system.includes('Code Reviewer');

    if (isReviewer && payload.tool_choice !== 'none') {
      assert.deepEqual(payload.tools.map((tool) => tool.function.name), ['github_read_file']);
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'review_read',
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

    if (isReviewer) {
      assert.equal(payload.tool_choice, 'none');
      assert.match(payload.messages.at(-1).content, /# Hafize nested/);
      return { choices: [{ message: { role: 'assistant', content: 'Reviewer nested sonucu.' } }] };
    }

    if (payload.tool_choice !== 'none') {
      assert.deepEqual(payload.tools.map((tool) => tool.function.name), ['agent_delegate']);
      return {
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'nested_delegate',
              type: 'function',
              function: {
                name: 'agent_delegate',
                arguments: JSON.stringify({
                  agentId: reviewer.id,
                  task: 'README.md dosyasını oku ve sonucu bildir.'
                })
              }
            }]
          }
        }]
      };
    }

    assert.equal(payload.tool_choice, 'none');
    assert.match(payload.messages.at(-1).content, /Reviewer nested sonucu/);
    return { choices: [{ message: { role: 'assistant', content: 'Orchestrator nested sonucu sentezledi.' } }] };
  }
});

assert.deepEqual(nestedResult, { ok: true, content: 'Orchestrator nested sonucu sentezledi.' });
assert.equal(nestedPayloads.length, 4);
const nestedSnapshot = nestedLedger.snapshot();
const nestedDelegation = nestedSnapshot.entries.find((entry) =>
  entry.action === 'agent.delegate'
  && entry.agentId === reviewer.id
  && entry.parentTaskId === outerDelegation.taskId
);
assert.ok(nestedDelegation);
assert.equal(nestedDelegation.status, 'completed');
const nestedRead = nestedSnapshot.entries.find((entry) =>
  entry.action === 'tool:github_read_file'
  && entry.agentId === reviewer.id
  && entry.parentTaskId === nestedDelegation.taskId
);
assert.ok(nestedRead);
assert.equal(nestedRead.status, 'completed');
const orchestratorDelegateTool = nestedSnapshot.entries.find((entry) =>
  entry.action === 'tool:agent_delegate'
  && entry.agentId === orchestrator.id
  && entry.parentTaskId === outerDelegation.taskId
);
assert.ok(orchestratorDelegateTool);
assert.equal(orchestratorDelegateTool.status, 'completed');
assert.equal(JSON.stringify(nestedSnapshot).includes('README.md dosyasını oku'), false);
assert.equal(JSON.stringify(nestedSnapshot).includes('# Hafize nested'), false);

console.log('delegated agent runner tests passed');
