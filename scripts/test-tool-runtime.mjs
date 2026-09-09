import assert from 'node:assert/strict';
import { loadAgentRegistry, resolveAgent } from '../lib/agent-runtime.mjs';
import {
  executeNvidiaToolCall,
  getAllowedNvidiaTools,
  getPublicToolActivity,
  getPublicToolRunningActivity,
  listToolPermissions
} from '../lib/tool-runtime.mjs';

const registry = await loadAgentRegistry();
const hafize = resolveAgent(registry, 'hafize-general');
const reviewer = resolveAgent(registry, 'agency-code-reviewer');
const engineer = resolveAgent(registry, 'agency-minimal-engineer');

assert.ok(hafize);
assert.ok(reviewer);
assert.ok(engineer);
assert.deepEqual(listToolPermissions(), [
  { permission: 'runtime.status', functionName: 'runtime_status' },
  { permission: 'agent.delegate', functionName: 'agent_delegate' },
  { permission: 'repo.read', functionName: 'github_read_file' },
  { permission: 'connector.canva.read', functionName: 'canva_read' },
  { permission: 'connector.gmail.read', functionName: 'gmail_read' },
  { permission: 'skill.invoke', functionName: 'skill_invoke' }
]);

assert.deepEqual(getPublicToolRunningActivity('runtime_status'), { label: 'Runtime durumu kontrol ediliyor', state: 'running' });
assert.deepEqual(getPublicToolRunningActivity('agent_delegate'), { label: 'Uzman ajan çalıştırılıyor', state: 'running' });
assert.deepEqual(getPublicToolRunningActivity('github_read_file'), { label: 'GitHub dosyası okunuyor', state: 'running' });
assert.deepEqual(getPublicToolRunningActivity('skill_invoke'), { label: 'Hafize skill’i hazırlanıyor', state: 'running' });
assert.equal(getPublicToolRunningActivity('repo_delete'), null);
assert.equal(getPublicToolRunningActivity(null), null);
const safeRunningActivity = JSON.stringify(getPublicToolRunningActivity('github_read_file'));
assert.equal(safeRunningActivity.includes('repository'), false);
assert.equal(safeRunningActivity.includes('path'), false);
assert.equal(safeRunningActivity.includes('token'), false);

assert.deepEqual(getPublicToolActivity('runtime_status', { ok: true }), { label: 'Runtime durumu kontrol edildi', state: 'success' });
assert.deepEqual(getPublicToolActivity('agent_delegate', { ok: false, error: 'PRIVATE_INTERNAL_DETAIL' }), { label: 'Uzman ajan çalıştırılamadı', state: 'failure' });
assert.deepEqual(getPublicToolActivity('skill_invoke', { ok: true, value: { prompt: 'secret: do not leak' } }), { label: 'Hafize skill’i hazırlandı', state: 'success' });
assert.deepEqual(
  getPublicToolActivity('github_read_file', { ok: true, value: { repository: 'private-owner/private-repo', path: 'secret.txt', content: 'NVIDIA_API_KEY=should-never-leak' } }),
  { label: 'GitHub dosyası okundu', state: 'success' }
);
assert.equal(getPublicToolActivity('repo_delete', { ok: true }), null);

// agent_delegate is only offered when the runtime actually wired a delegator into the
// context; without it the primary agent still keeps its read-only surface.
const hafizeTools = getAllowedNvidiaTools(hafize, { githubReadConfigured: true });
assert.deepEqual(hafizeTools.map((tool) => tool.function.name), ['runtime_status', 'skill_invoke']);
assert.deepEqual(
  getAllowedNvidiaTools(hafize, { githubReadConfigured: true, delegateAgent: () => ({ ok: true }) }).map((tool) => tool.function.name),
  ['runtime_status', 'agent_delegate', 'skill_invoke']
);
assert.deepEqual(
  getAllowedNvidiaTools(reviewer, { githubReadConfigured: true }).map((tool) => tool.function.name),
  ['github_read_file', 'skill_invoke']
);
assert.deepEqual(
  getAllowedNvidiaTools(engineer, { githubReadConfigured: true }).map((tool) => tool.function.name),
  ['github_read_file', 'skill_invoke']
);
assert.deepEqual(getAllowedNvidiaTools(reviewer, { githubReadConfigured: false }).map((tool) => tool.function.name), ['skill_invoke']);

const traceId = '00000000-0000-4000-8000-000000000001';
const result = await executeNvidiaToolCall(
  hafize,
  { id: 'call_1', type: 'function', function: { name: 'runtime_status', arguments: '{}' } },
  { traceId, agent: hafize, registry, nvidiaConfigured: true, githubReadConfigured: true, approvalGranted: false }
);
assert.equal(result.ok, true);
assert.equal(result.value.traceId, traceId);
assert.equal(result.value.agentId, 'hafize-general');
assert.equal(result.value.nvidiaConfigured, true);
assert.equal(result.value.githubReadConfigured, true);
assert.ok(Array.isArray(result.value.availableAgents));
assert.equal(JSON.stringify(result).includes('NVIDIA_API_KEY'), false);

const credentialBearingToolResult = await executeNvidiaToolCall(
  reviewer,
  { id: 'call_credential_1', type: 'function', function: { name: 'github_read_file', arguments: '{"repository":"x/y","path":"README.md"}' } },
  { traceId, agent: reviewer, registry, githubReadConfigured: true, githubReadFile: async () => ({ content: 'Authorization: Bearer abcdefghijk' }), approvalGranted: false }
);
assert.deepEqual(credentialBearingToolResult, { ok: false, error: 'TOOL_RESULT_CREDENTIAL_BLOCKED' });

const credentialFieldToolResult = await executeNvidiaToolCall(
  reviewer,
  { id: 'call_credential_2', type: 'function', function: { name: 'github_read_file', arguments: '{"repository":"x/y","path":"README.md"}' } },
  { traceId, agent: reviewer, registry, githubReadConfigured: true, githubReadFile: async () => ({ content: 'normal', access_token: 'opaque-secret' }), approvalGranted: false }
);
assert.deepEqual(credentialFieldToolResult, { ok: false, error: 'TOOL_RESULT_CREDENTIAL_FIELD_BLOCKED' });

const accessorsToolResult = await executeNvidiaToolCall(
  reviewer,
  { id: 'call_credential_3', type: 'function', function: { name: 'github_read_file', arguments: '{"repository":"x/y","path":"README.md"}' } },
  { traceId, agent: reviewer, registry, githubReadConfigured: true, githubReadFile: async () => {
    const value = {};
    Object.defineProperty(value, 'content', { enumerable: true, get() { return 'hidden'; } });
    return value;
  }, approvalGranted: false }
);
assert.deepEqual(accessorsToolResult, { ok: false, error: 'TOOL_RESULT_ACCESSOR_BLOCKED' });

const skillResult = await executeNvidiaToolCall(
  hafize,
  {
    id: 'call_skill_1',
    type: 'function',
    function: { name: 'skill_invoke', arguments: JSON.stringify({ skillId: 'runtime-diagnostics', args: { question: 'Runtime hazır mı?' } }) }
  },
  { traceId, agent: hafize, registry, approvalGranted: false }
);
assert.equal(skillResult.ok, true);
assert.equal(skillResult.value.skill, 'runtime-diagnostics');
assert.deepEqual(skillResult.value.tools, ['runtime.status']);
assert.match(skillResult.value.prompt, /Runtime teşhis modunda çalış/);
assert.equal(JSON.stringify(skillResult).includes('should-never-leak'), false);

const codeSkill = await executeNvidiaToolCall(
  reviewer,
  {
    id: 'call_skill_2',
    type: 'function',
    function: { name: 'skill_invoke', arguments: JSON.stringify({ skillId: 'code-inspection', args: { focus: 'tool runtime' } }) }
  },
  { traceId, agent: reviewer, registry, githubReadConfigured: true, approvalGranted: false }
);
assert.equal(codeSkill.ok, true);
assert.deepEqual(codeSkill.value.tools, ['repo.read', 'runtime.status'].filter((tool) => reviewer.toolPolicy.allow.includes(tool)));

const invalidSkillArgs = await executeNvidiaToolCall(
  hafize,
  {
    id: 'call_skill_3',
    type: 'function',
    function: { name: 'skill_invoke', arguments: JSON.stringify({ skillId: 'runtime-diagnostics', args: { question: 'x', token: 'secret' } }) }
  },
  { traceId, agent: hafize, registry, approvalGranted: false }
);
assert.equal(invalidSkillArgs.ok, false);
assert.match(invalidSkillArgs.error, /UNKNOWN_SKILL_ARGUMENT|SKILL_ARGUMENT_SECRET_MATERIAL/);

const unknownSkill = await executeNvidiaToolCall(
  hafize,
  { id: 'call_skill_4', type: 'function', function: { name: 'skill_invoke', arguments: JSON.stringify({ skillId: 'does-not-exist' }) } },
  { traceId, agent: hafize, registry, approvalGranted: false }
);
assert.deepEqual(unknownSkill, { ok: false, error: 'UNKNOWN_SKILL' });

const deniedRuntime = await executeNvidiaToolCall(
  reviewer,
  { id: 'call_2', type: 'function', function: { name: 'runtime_status', arguments: '{}' } },
  { traceId, agent: reviewer, registry, nvidiaConfigured: true, githubReadConfigured: true, approvalGranted: false }
);
assert.equal(deniedRuntime.ok, false);
assert.equal(deniedRuntime.error, 'TOOL_NOT_AUTHORIZED');

const githubResult = await executeNvidiaToolCall(
  reviewer,
  { id: 'call_3', type: 'function', function: { name: 'github_read_file', arguments: JSON.stringify({ repository: 'umitalgan061-sudo/hafize', path: 'README.md' }) } },
  { traceId, agent: reviewer, registry, nvidiaConfigured: true, githubReadConfigured: true, githubReadFile: async (args) => ({ ...args, content: '# Hafize', truncated: false }), approvalGranted: false }
);
assert.equal(githubResult.ok, true);
assert.equal(githubResult.value.repository, 'umitalgan061-sudo/hafize');
assert.equal(githubResult.value.content, '# Hafize');

const unavailableGithub = await executeNvidiaToolCall(
  reviewer,
  { id: 'call_4', type: 'function', function: { name: 'github_read_file', arguments: '{"repository":"x/y","path":"README.md"}' } },
  { traceId, agent: reviewer, registry, githubReadConfigured: false }
);
assert.deepEqual(unavailableGithub, { ok: false, error: 'TOOL_UNAVAILABLE' });

const deniedGithub = await executeNvidiaToolCall(
  hafize,
  { id: 'call_5', type: 'function', function: { name: 'github_read_file', arguments: '{"repository":"x/y","path":"README.md"}' } },
  { traceId, agent: hafize, registry, githubReadConfigured: true, githubReadFile: async () => ({}) }
);
assert.equal(deniedGithub.ok, false);
assert.equal(deniedGithub.error, 'TOOL_NOT_AUTHORIZED');

const safeExecutionError = await executeNvidiaToolCall(
  reviewer,
  { id: 'call_6', type: 'function', function: { name: 'github_read_file', arguments: '{"repository":"x/y","path":"README.md"}' } },
  { traceId, agent: reviewer, registry, githubReadConfigured: true, githubReadFile: async () => { const error = new Error('do not expose this internal detail'); error.code = 'GITHUB_REPO_NOT_ALLOWED'; error.status = 403; throw error; } }
);
assert.deepEqual(safeExecutionError, { ok: false, error: 'GITHUB_REPO_NOT_ALLOWED', status: 403 });
assert.equal(JSON.stringify(safeExecutionError).includes('internal detail'), false);

const unknown = await executeNvidiaToolCall(
  hafize,
  { id: 'call_7', type: 'function', function: { name: 'repo_delete', arguments: '{}' } },
  { traceId, agent: hafize, registry, nvidiaConfigured: true, approvalGranted: false }
);
assert.deepEqual(unknown, { ok: false, error: 'UNKNOWN_TOOL' });

console.log('Tool runtime OK: authorization, safe activity, credential-safe egress, delegation and configured GitHub repo.read are policy-gated');
