import assert from 'node:assert/strict';
import {
  buildAgentSystemMessage,
  loadAgentRegistry,
  resolveAgent
} from '../lib/agent-runtime.mjs';
import { createAgentExecutor, validateDelegation } from '../lib/agent-executor.mjs';
import { executeNvidiaToolCall, getAllowedNvidiaTools } from '../lib/tool-runtime.mjs';

const registry = await loadAgentRegistry();
const hafize = resolveAgent(registry, 'hafize-general');
const orchestrator = resolveAgent(registry, 'agency-orchestrator');
const reviewer = resolveAgent(registry, 'agency-code-reviewer');

assert.ok(hafize);
assert.ok(orchestrator);
assert.ok(reviewer);

const valid = validateDelegation({
  registry,
  sourceAgent: hafize,
  targetAgentId: 'agency-orchestrator',
  task: 'Repo inceleme görevini uzmanlara ayır.',
  depth: 0
});
assert.equal(valid.target.id, 'agency-orchestrator');
assert.equal(valid.nextDepth, 1);

assert.throws(
  () => validateDelegation({ registry, sourceAgent: hafize, targetAgentId: 'hafize-general', task: 'x', depth: 0 }),
  (error) => error?.code === 'DELEGATION_SELF_TARGET_BLOCKED'
);
assert.throws(
  () => validateDelegation({ registry, sourceAgent: orchestrator, targetAgentId: 'hafize-general', task: 'x', depth: 1 }),
  (error) => error?.code === 'DELEGATION_TARGET_NOT_SPECIALIST'
);
assert.throws(
  () => validateDelegation({
    registry,
    sourceAgent: orchestrator,
    targetAgentId: 'agency-code-reviewer',
    task: 'x',
    depth: registry.policy.maxDelegationDepth
  }),
  (error) => error?.code === 'DELEGATION_DEPTH_EXCEEDED'
);

const calls = [];
function assistantResponse(message) {
  return { choices: [{ message: { role: 'assistant', ...message } }] };
}

async function fakeComplete(payload) {
  const system = payload.messages?.[0]?.content || '';
  const agentName = system.includes('Code Reviewer')
    ? 'reviewer'
    : system.includes('Orchestrator')
      ? 'orchestrator'
      : 'hafize';
  calls.push({ agentName, toolChoice: payload.tool_choice || null, tools: payload.tools?.map((tool) => tool.function.name) || [] });

  if (payload.tool_choice === 'none') {
    if (agentName === 'reviewer') return assistantResponse({ content: 'README incelendi.' });
    if (agentName === 'orchestrator') return assistantResponse({ content: 'Reviewer sonucu sentezlendi.' });
    return assistantResponse({ content: 'Uzman zinciri tamamlandı.' });
  }

  if (agentName === 'hafize') {
    assert.ok(payload.tools.some((tool) => tool.function.name === 'agent_delegate'));
    return assistantResponse({
      content: null,
      tool_calls: [{
        id: 'delegate_1',
        type: 'function',
        function: {
          name: 'agent_delegate',
          arguments: JSON.stringify({
            agentId: 'agency-orchestrator',
            task: 'Hafize reposunu inceleme görevini uygun uzmana devret.'
          })
        }
      }]
    });
  }

  if (agentName === 'orchestrator') {
    assert.ok(payload.tools.some((tool) => tool.function.name === 'agent_delegate'));
    return assistantResponse({
      content: null,
      tool_calls: [{
        id: 'delegate_2',
        type: 'function',
        function: {
          name: 'agent_delegate',
          arguments: JSON.stringify({
            agentId: 'agency-code-reviewer',
            task: 'README.md dosyasını güvenli biçimde oku ve özetle.'
          })
        }
      }]
    });
  }

  assert.ok(payload.tools.some((tool) => tool.function.name === 'github_read_file'));
  return assistantResponse({
    content: null,
    tool_calls: [{
      id: 'github_1',
      type: 'function',
      function: {
        name: 'github_read_file',
        arguments: JSON.stringify({ repository: 'umitalgan061-sudo/hafize', path: 'README.md' })
      }
    }]
  });
}

const executor = createAgentExecutor({
  registry,
  complete: fakeComplete,
  buildSystemMessage: buildAgentSystemMessage,
  getAllowedTools: getAllowedNvidiaTools,
  executeTool: executeNvidiaToolCall,
  toolContextFactory: () => ({
    nvidiaConfigured: true,
    githubReadConfigured: true,
    githubReadFile: async ({ repository, path }) => ({
      repository,
      path,
      ref: null,
      content: '# Hafize',
      truncated: false
    })
  })
});

const result = await executor.run({
  model: 'mock/model',
  agent: hafize,
  messages: [{ role: 'user', content: 'Hafize reposunu incele.' }],
  traceId: '00000000-0000-4000-8000-000000000123',
  maxTokens: 512
});

assert.equal(result.content, 'Uzman zinciri tamamlandı.');
assert.deepEqual(result.tools, [{ name: 'agent_delegate', ok: true, error: null }]);
assert.equal(result.ledger.length, 2);
assert.deepEqual(
  result.ledger.map(({ parentAgentId, agentId, depth, status }) => ({ parentAgentId, agentId, depth, status })),
  [
    { parentAgentId: 'hafize-general', agentId: 'agency-orchestrator', depth: 1, status: 'completed' },
    { parentAgentId: 'agency-orchestrator', agentId: 'agency-code-reviewer', depth: 2, status: 'completed' }
  ]
);
assert.ok(calls.some((call) => call.agentName === 'reviewer' && call.tools.includes('github_read_file')));
assert.ok(calls.every((call) => !call.tools.includes('repo.merge')));
assert.equal(JSON.stringify(result).includes('GITHUB_TOKEN'), false);

console.log('Agent executor OK: Hafize -> Orchestrator -> Code Reviewer delegation is bounded and policy-gated');
