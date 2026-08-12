import assert from 'node:assert/strict';
import { createAgentDelegator } from '../lib/agent-delegation.mjs';
import { createAgentRunLedger } from '../lib/agent-run-ledger.mjs';
import { runDelegatedAgent } from '../lib/delegated-agent-runner.mjs';

const primary = {
  id: 'hafize-general',
  name: 'Hafize',
  kind: 'primary',
  description: 'Ana ajan.',
  toolPolicy: { default: 'deny', allow: ['runtime.status', 'agent.delegate'] }
};
const orchestrator = {
  id: 'agency-orchestrator',
  name: 'Orchestrator',
  kind: 'specialist',
  description: 'Orkestratör.',
  toolPolicy: {
    default: 'deny',
    allow: ['agent.delegate'],
    deny: ['external.write', 'repo.merge']
  }
};
const reviewer = {
  id: 'agency-code-reviewer',
  name: 'Code Reviewer',
  kind: 'specialist',
  description: 'Reviewer.',
  toolPolicy: {
    default: 'deny',
    allow: ['repo.read'],
    deny: ['repo.write_branch', 'repo.merge']
  }
};
const registry = {
  defaultAgent: primary.id,
  policy: { maxDelegationDepth: 3, maxParallelAgents: 2 },
  agents: [primary, orchestrator, reviewer]
};

const traceId = 'trace-nested';
const ledger = createAgentRunLedger({ traceId, agentId: primary.id });
const seen = [];

async function complete(payload) {
  const system = payload.messages[0]?.content || '';
  const agentId = system.includes('Orchestrator')
    ? orchestrator.id
    : system.includes('Code Reviewer')
      ? reviewer.id
      : 'unknown';
  seen.push({ agentId, payload });
  const agentCalls = seen.filter((item) => item.agentId === agentId).length;

  if (agentId === orchestrator.id && agentCalls === 1) {
    assert.deepEqual(payload.tools.map((tool) => tool.function.name), ['agent_delegate']);
    assert.equal(payload.tools.some((tool) => tool.function.name === 'runtime_status'), false);
    return {
      choices: [{
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'nested_call_1',
            type: 'function',
            function: {
              name: 'agent_delegate',
              arguments: JSON.stringify({
                agentId: reviewer.id,
                task: 'Güvenlik açısından incele.'
              })
            }
          }]
        }
      }]
    };
  }

  if (agentId === reviewer.id) {
    assert.equal('tools' in payload, false);
    return { choices: [{ message: { role: 'assistant', content: 'Reviewer sonucu.' } }] };
  }

  assert.equal(agentId, orchestrator.id);
  assert.equal(payload.tool_choice, 'none');
  assert.equal(payload.messages.at(-1).role, 'tool');
  assert.match(payload.messages.at(-1).content, /Reviewer sonucu/);
  return { choices: [{ message: { role: 'assistant', content: 'Orkestrasyon tamamlandı.' } }] };
}

async function executeAgent({ agent, task, traceId: childTraceId, depth, parentTaskId }) {
  return runDelegatedAgent({
    agent,
    task,
    traceId: childTraceId,
    parentTaskId,
    depth,
    registry,
    runLedger: ledger,
    model: 'mock-model',
    complete
  });
}

const rootDelegator = createAgentDelegator({
  registry,
  traceId,
  parentAgent: primary,
  parentTaskId: ledger.rootTaskId,
  runLedger: ledger,
  executeAgent
});

const result = await rootDelegator.delegate(
  { agentId: orchestrator.id, task: 'Bu işi alt uzmana böl.' },
  { depth: 0 }
);
assert.deepEqual(result, {
  ok: true,
  value: {
    agentId: orchestrator.id,
    agentName: orchestrator.name,
    content: 'Orkestrasyon tamamlandı.'
  }
});

const entries = ledger.snapshot().entries;
assert.equal(entries.every((entry) => entry.traceId === traceId), true);
const orchestratorDelegation = entries.find(
  (entry) => entry.action === 'agent.delegate' && entry.agentId === orchestrator.id
);
const reviewerDelegation = entries.find(
  (entry) => entry.action === 'agent.delegate' && entry.agentId === reviewer.id
);
const delegateTool = entries.find(
  (entry) => entry.action === 'tool:agent_delegate' && entry.agentId === orchestrator.id
);
assert.equal(orchestratorDelegation.parentTaskId, ledger.rootTaskId);
assert.equal(reviewerDelegation.parentTaskId, orchestratorDelegation.taskId);
assert.equal(delegateTool.parentTaskId, orchestratorDelegation.taskId);
assert.equal(orchestratorDelegation.status, 'completed');
assert.equal(reviewerDelegation.status, 'completed');
assert.equal(delegateTool.status, 'completed');

const exhausted = await rootDelegator.delegate(
  { agentId: reviewer.id, task: 'Ek görev.' },
  { depth: 0 }
);
assert.deepEqual(exhausted, { ok: false, error: 'DELEGATION_FANOUT_EXCEEDED' });

console.log('nested delegation tests passed');
