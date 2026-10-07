import assert from 'node:assert/strict';
import { loadAgentRegistry, resolveAgent } from '../lib/agent-runtime.mjs';
import { createSkillsRuntime } from '../lib/skills-runtime.mjs';
import {
  executeNvidiaToolCall,
  getAllowedNvidiaTools,
  getPublicToolActivity,
  getPublicToolRunningActivity,
  listToolPermissions
} from '../lib/tool-runtime.mjs';
import { assertToolResult } from './tool-result-contract.mjs';

// Activity descriptors also carry the tool name and its timeout; a suite
// asserting the user-visible contract compares the keys it names.
const assertActivity = (actual, expected) => {
  assert.ok(actual, 'missing activity descriptor');
  assert.deepEqual(
    Object.fromEntries(Object.keys(expected).map((key) => [key, actual[key]])),
    expected
  );
};


const registry = await loadAgentRegistry();
const hafize = resolveAgent(registry, 'hafize-general');
const reviewer = resolveAgent(registry, 'agency-code-reviewer');
const engineer = resolveAgent(registry, 'agency-minimal-engineer');

assert.ok(hafize);
assert.ok(reviewer);
assert.ok(engineer);
// The catalog carries more per-tool metadata than this suite cares about
// (kind, timeout), so the assertion pins the permission-to-tool mapping and
// its order rather than the whole descriptor.
assert.deepEqual(listToolPermissions().map(({ permission, name }) => ({ permission, name })), [
  { permission: 'runtime.status', name: 'runtime_status' },
  { permission: 'agent.delegate', name: 'agent_delegate' },
  { permission: 'repo.read', name: 'github_read_file' },
  { permission: 'connector.canva.read', name: 'canva_read' },
  { permission: 'connector.gmail.read', name: 'gmail_read' },
  { permission: 'skill.invoke', name: 'skill_invoke' }
]);

assertActivity(getPublicToolRunningActivity('runtime_status'), { label: 'Runtime durumu kontrol ediliyor', state: 'running' });
assertActivity(getPublicToolRunningActivity('agent_delegate'), { label: 'Uzman ajan çalıştırılıyor', state: 'running' });
assertActivity(getPublicToolRunningActivity('github_read_file'), { label: 'GitHub dosyası okunuyor', state: 'running' });
assertActivity(getPublicToolRunningActivity('skill_invoke'), { label: 'Hafize skill’i hazırlanıyor', state: 'running' });
assert.equal(getPublicToolRunningActivity('repo_delete'), null);
assert.equal(getPublicToolRunningActivity(null), null);
const safeRunningActivity = JSON.stringify(getPublicToolRunningActivity('github_read_file'));
assert.equal(safeRunningActivity.includes('repository'), false);
assert.equal(safeRunningActivity.includes('path'), false);
assert.equal(safeRunningActivity.includes('token'), false);

assertActivity(getPublicToolActivity('runtime_status', { ok: true }), { label: 'Runtime durumu kontrol edildi', state: 'success' });
assertActivity(getPublicToolActivity('agent_delegate', { ok: false, error: 'PRIVATE_INTERNAL_DETAIL' }), { label: 'Uzman ajan çalıştırılamadı', state: 'failure' });
assertActivity(getPublicToolActivity('skill_invoke', { ok: true, value: { prompt: 'secret: do not leak' } }), { label: 'Hafize skill’i hazırlandı', state: 'success' });
// Deliberately exact: this asserts the public descriptor carries nothing but
// the safe label, state and tool name, so a newly leaked field fails here.
assert.deepEqual(
  getPublicToolActivity('github_read_file', { ok: true, value: { repository: 'private-owner/private-repo', path: 'secret.txt', content: 'NVIDIA_API_KEY=should-never-leak' } }),
  { label: 'GitHub dosyası okundu', state: 'success', tool: 'github_read_file' }
);
assert.equal(getPublicToolActivity('repo_delete', { ok: true }), null);

// A tool is only advertised once the runtime can actually serve it:
// agent_delegate needs a delegator, github_read_file a reader, and skill_invoke
// a skills runtime. runtime_status is the only tool with no dependency.
const skillsRuntime = await createSkillsRuntime({ fileUrl: new URL('../skills/builtin.json', import.meta.url) });
const hafizeTools = getAllowedNvidiaTools(hafize, { githubReadConfigured: true });
assert.deepEqual(hafizeTools.map((tool) => tool.function.name), ['runtime_status']);
assert.deepEqual(
  getAllowedNvidiaTools(hafize, { githubReadConfigured: true, skillsRuntime }).map((tool) => tool.function.name),
  ['runtime_status', 'skill_invoke']
);
assert.deepEqual(
  getAllowedNvidiaTools(hafize, { githubReadConfigured: true, skillsRuntime, delegateAgent: async () => ({ ok: true }) }).map((tool) => tool.function.name),
  ['runtime_status', 'agent_delegate', 'skill_invoke']
);
const githubContext = { githubReadConfigured: true, githubReadFile: async () => ({ ok: true, value: { content: '' } }), skillsRuntime };
assert.deepEqual(
  getAllowedNvidiaTools(reviewer, githubContext).map((tool) => tool.function.name),
  ['github_read_file', 'skill_invoke']
);
assert.deepEqual(
  getAllowedNvidiaTools(engineer, githubContext).map((tool) => tool.function.name),
  ['github_read_file', 'skill_invoke']
);
assert.deepEqual(
  getAllowedNvidiaTools(reviewer, { ...githubContext, githubReadConfigured: false }).map((tool) => tool.function.name),
  ['skill_invoke']
);

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
assertToolResult(credentialBearingToolResult, { ok: false, error: 'TOOL_RESULT_CREDENTIAL_BLOCKED' });

const credentialFieldToolResult = await executeNvidiaToolCall(
  reviewer,
  { id: 'call_credential_2', type: 'function', function: { name: 'github_read_file', arguments: '{"repository":"x/y","path":"README.md"}' } },
  { traceId, agent: reviewer, registry, githubReadConfigured: true, githubReadFile: async () => ({ content: 'normal', access_token: 'opaque-secret' }), approvalGranted: false }
);
assertToolResult(credentialFieldToolResult, { ok: false, error: 'TOOL_RESULT_CREDENTIAL_FIELD_BLOCKED' });

const accessorsToolResult = await executeNvidiaToolCall(
  reviewer,
  { id: 'call_credential_3', type: 'function', function: { name: 'github_read_file', arguments: '{"repository":"x/y","path":"README.md"}' } },
  { traceId, agent: reviewer, registry, githubReadConfigured: true, githubReadFile: async () => {
    const value = {};
    Object.defineProperty(value, 'content', { enumerable: true, get() { return 'hidden'; } });
    return value;
  }, approvalGranted: false }
);
assertToolResult(accessorsToolResult, { ok: false, error: 'TOOL_RESULT_ACCESSOR_BLOCKED' });

const skillResult = await executeNvidiaToolCall(
  hafize,
  {
    id: 'call_skill_1',
    type: 'function',
    function: { name: 'skill_invoke', arguments: JSON.stringify({ skillId: 'runtime-diagnostics', args: { question: 'Runtime hazır mı?' } }) }
  },
  { traceId, agent: hafize, registry, skillsRuntime, approvalGranted: false }
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
  { traceId, agent: reviewer, registry, githubReadConfigured: true, skillsRuntime, approvalGranted: false }
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
  { traceId, agent: hafize, registry, skillsRuntime, approvalGranted: false }
);
assert.equal(invalidSkillArgs.ok, false);
assert.match(invalidSkillArgs.error, /UNKNOWN_SKILL_ARGUMENT|SKILL_ARGUMENT_SECRET_MATERIAL/);

const unknownSkill = await executeNvidiaToolCall(
  hafize,
  { id: 'call_skill_4', type: 'function', function: { name: 'skill_invoke', arguments: JSON.stringify({ skillId: 'does-not-exist' }) } },
  { traceId, agent: hafize, registry, skillsRuntime, approvalGranted: false }
);
assertToolResult(unknownSkill, { ok: false, error: 'UNKNOWN_SKILL' });

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
assertToolResult(unavailableGithub, { ok: false, error: 'TOOL_UNAVAILABLE' });

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
assertToolResult(safeExecutionError, { ok: false, error: 'GITHUB_REPO_NOT_ALLOWED', status: 403 });
assert.equal(JSON.stringify(safeExecutionError).includes('internal detail'), false);

const unknown = await executeNvidiaToolCall(
  hafize,
  { id: 'call_7', type: 'function', function: { name: 'repo_delete', arguments: '{}' } },
  { traceId, agent: hafize, registry, nvidiaConfigured: true, approvalGranted: false }
);
assertToolResult(unknown, { ok: false, error: 'UNKNOWN_TOOL' });

console.log('Tool runtime OK: authorization, safe activity, credential-safe egress, delegation and configured GitHub repo.read are policy-gated');
