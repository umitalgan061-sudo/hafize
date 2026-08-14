import assert from 'node:assert/strict';
import { createAgentDelegator } from '../lib/agent-delegation.mjs';
import { createAgentRunLedger } from '../lib/agent-run-ledger.mjs';

const primary = {
  id: 'hafize-general',
  name: 'Hafize',
  kind: 'primary',
  toolPolicy: { default: 'deny', allow: ['agent.delegate'] }
};
const reviewer = {
  id: 'agency-code-reviewer',
  name: 'Code Reviewer',
  kind: 'specialist',
  toolPolicy: { default: 'deny', allow: ['repo.read'] }
};
const registry = {
  defaultAgent: primary.id,
  policy: { maxDelegationDepth: 2, maxParallelAgents: 1 },
  agents: [primary, reviewer]
};

const runLedger = createAgentRunLedger({
  traceId: 'trace-delegation-test',
  agentId: primary.id,
  now: () => new Date('2026-08-12T08:00:00.000Z')
});
const calls = [];
const delegator = createAgentDelegator({
  registry,
  traceId: 'trace-delegation-test',
  parentAgent: primary,
  parentTaskId: runLedger.rootTaskId,
  runLedger,
  async executeAgent(input) {
    calls.push(input);
    return { ok: true, content: 'review-result' };
  }
});

const success = await delegator.delegate({ agentId: reviewer.id, task: 'Bu diffi incele.' });
assert.deepEqual(success, {
  ok: true,
  value: { agentId: reviewer.id, agentName: reviewer.name, content: 'review-result' }
});
assert.equal(calls.length, 1);
assert.equal(calls[0].traceId, 'trace-delegation-test');
assert.equal(calls[0].depth, 1);
assert.equal(calls[0].agent, reviewer);
assert.equal(calls[0].task, 'Bu diffi incele.');
assert.equal(calls[0].agent.toolPolicy.allow.includes('agent.delegate'), false);
assert.equal(calls[0].signal instanceof AbortSignal, true);

const structuredLedger = createAgentRunLedger({
  traceId: 'trace-structured-handoff',
  agentId: primary.id
});
const structuredCalls = [];
const structuredDelegator = createAgentDelegator({
  registry,
  traceId: 'trace-structured-handoff',
  parentAgent: primary,
  parentTaskId: structuredLedger.rootTaskId,
  runLedger: structuredLedger,
  async executeAgent(input) {
    structuredCalls.push(input);
    return { ok: true, content: 'structured-result' };
  }
});
const structured = await structuredDelegator.delegate({
  agentId: reviewer.id,
  task: 'PR değişikliğini incele.',
  successCriteria: ['Bulgular önem derecesiyle sıralansın'],
  constraints: ['Kodu değiştirme'],
  evidenceRequired: ['İncelenen dosyaları belirt']
});
assert.equal(structured.ok, true);
assert.equal(structuredCalls.length, 1);
assert.match(structuredCalls[0].task, /^Görev: PR değişikliğini incele\./);
assert.match(structuredCalls[0].task, /Başarı ölçütleri:\n- Bulgular önem derecesiyle sıralansın/);
assert.match(structuredCalls[0].task, /Kısıtlar:\n- Kodu değiştirme/);
assert.match(structuredCalls[0].task, /Beklenen kanıt:\n- İncelenen dosyaları belirt/);
assert.doesNotMatch(structuredCalls[0].task, /agency-code-reviewer/);

const snapshot = runLedger.snapshot();
const delegationEntry = snapshot.entries.find((entry) => entry.action === 'agent.delegate');
assert.equal(delegationEntry.agentId, reviewer.id);
assert.equal(delegationEntry.parentTaskId, runLedger.rootTaskId);
assert.equal(delegationEntry.status, 'completed');
assert.equal(delegationEntry.detail, 'ok');

const sequential = await delegator.delegate({ agentId: reviewer.id, task: 'İkinci seri görev.' });
assert.equal(sequential.ok, true);
assert.equal(calls.length, 2);
assert.equal(delegator.lifecycleSnapshot().active, 0);

const depthLedger = createAgentRunLedger({ traceId: 'trace-depth', agentId: primary.id });
const depthDelegator = createAgentDelegator({
  registry,
  traceId: 'trace-depth',
  parentAgent: primary,
  parentTaskId: depthLedger.rootTaskId,
  runLedger: depthLedger,
  async executeAgent() {
    throw new Error('should not execute');
  }
});
assert.deepEqual(
  await depthDelegator.delegate({ agentId: reviewer.id, task: 'Derin görev.' }, { depth: 2 }),
  { ok: false, error: 'DELEGATION_DEPTH_EXCEEDED' }
);
assert.deepEqual(
  await depthDelegator.delegate({ agentId: primary.id, task: 'Kendine dön.' }),
  { ok: false, error: 'SELF_DELEGATION_NOT_ALLOWED' }
);
assert.deepEqual(
  await depthDelegator.delegate({ agentId: 'missing-agent', task: 'Yok.' }),
  { ok: false, error: 'DELEGATION_TARGET_NOT_FOUND' }
);
assert.deepEqual(
  await depthDelegator.delegate({ agentId: reviewer.id, task: ' '.repeat(4) }),
  { ok: false, error: 'INVALID_DELEGATION_ARGUMENTS' }
);
assert.deepEqual(
  await depthDelegator.delegate({ agentId: reviewer.id, task: 'Geçerli.', successCriteria: 'tek string' }),
  { ok: false, error: 'INVALID_DELEGATION_ARGUMENTS' }
);

console.log('agent delegation tests passed');

const { getAllowedNvidiaTools, executeNvidiaToolCall } = await import('../lib/tool-runtime.mjs');
const primaryTools = getAllowedNvidiaTools(primary, { delegateAgent: async () => ({ ok: true, value: {} }) });
assert.equal(primaryTools.some((tool) => tool.function.name === 'agent_delegate'), true);
const delegateTool = primaryTools.find((tool) => tool.function.name === 'agent_delegate');
for (const field of ['successCriteria', 'constraints', 'evidenceRequired']) {
  assert.equal(delegateTool.function.parameters.properties[field].type, 'array');
  assert.equal(delegateTool.function.parameters.properties[field].maxItems, 8);
  assert.equal(delegateTool.function.parameters.properties[field].items.maxLength, 500);
}
const reviewerTools = getAllowedNvidiaTools(reviewer, { delegateAgent: async () => ({ ok: true, value: {} }) });
assert.equal(reviewerTools.some((tool) => tool.function.name === 'agent_delegate'), false);

const toolSuccess = await executeNvidiaToolCall(
  primary,
  { function: { name: 'agent_delegate', arguments: JSON.stringify({ agentId: reviewer.id, task: 'Kontrol et.' }) } },
  { delegateAgent: async () => ({ ok: true, value: { agentId: reviewer.id, content: 'ok' } }) }
);
assert.equal(toolSuccess.ok, true);
assert.equal(toolSuccess.value.agentId, reviewer.id);

let structuredToolArgs = null;
const structuredToolSuccess = await executeNvidiaToolCall(
  primary,
  {
    function: {
      name: 'agent_delegate',
      arguments: JSON.stringify({
        agentId: reviewer.id,
        task: 'Kontrol et.',
        successCriteria: ['Tek bir karar üret'],
        constraints: ['Salt okunur kal'],
        evidenceRequired: ['Dosya yolunu belirt']
      })
    }
  },
  {
    delegateAgent: async (args) => {
      structuredToolArgs = args;
      return { ok: true, value: { agentId: reviewer.id, content: 'ok' } };
    }
  }
);
assert.equal(structuredToolSuccess.ok, true);
assert.deepEqual(structuredToolArgs.successCriteria, ['Tek bir karar üret']);
assert.deepEqual(structuredToolArgs.constraints, ['Salt okunur kal']);
assert.deepEqual(structuredToolArgs.evidenceRequired, ['Dosya yolunu belirt']);

const toolFailure = await executeNvidiaToolCall(
  primary,
  { function: { name: 'agent_delegate', arguments: JSON.stringify({ agentId: reviewer.id, task: 'Kontrol et.' }) } },
  { delegateAgent: async () => ({ ok: false, error: 'DELEGATION_DEPTH_EXCEEDED' }) }
);
assert.deepEqual(toolFailure, { ok: false, error: 'DELEGATION_DEPTH_EXCEEDED' });

console.log('agent delegate tool tests passed');
