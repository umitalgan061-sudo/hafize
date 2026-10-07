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
// The listing also carries each tool's kind and timeout; the mapping under test is
// tool name to required permission, and no tool may appear without one.
assert.deepEqual(listToolPermissions().map(({ name, permission }) => ({ name, permission })), [
  { name: 'runtime_status', permission: 'runtime.status' },
  { name: 'agent_delegate', permission: 'agent.delegate' },
  { name: 'github_read_file', permission: 'repo.read' },
  { name: 'canva_read', permission: 'connector.canva.read' },
  { name: 'gmail_read', permission: 'connector.gmail.read' },
  { name: 'skill_invoke', permission: 'skill.invoke' }
]);
for (const entry of listToolPermissions()) {
  assert.ok(entry.kind, `${entry.name} declares a tool kind`);
  assert.ok(Number.isInteger(entry.timeoutMs) && entry.timeoutMs > 0, `${entry.name} declares a timeout`);
}

// The activity payload also names the tool and its timeout, so the label/state
// pair is compared and the extra fields are checked for shape below.
const runningLabel = (tool) => {
  const activity = getPublicToolRunningActivity(tool);
  assert.equal(activity.tool, tool);
  assert.ok(Number.isInteger(activity.timeoutMs) && activity.timeoutMs > 0);
  return { label: activity.label, state: activity.state };
};
assert.deepEqual(runningLabel('runtime_status'), { label: 'Runtime durumu kontrol ediliyor', state: 'running' });
assert.deepEqual(runningLabel('agent_delegate'), { label: 'Uzman ajan çalıştırılıyor', state: 'running' });
assert.deepEqual(runningLabel('github_read_file'), { label: 'GitHub dosyası okunuyor', state: 'running' });
assert.deepEqual(runningLabel('skill_invoke'), { label: 'Hafize skill hazırlanıyor', state: 'running' });
assert.equal(getPublicToolRunningActivity('repo_delete'), null);
assert.equal(getPublicToolRunningActivity(null), null);
const safeRunningActivity = JSON.stringify(getPublicToolRunningActivity('github_read_file'));
assert.equal(safeRunningActivity.includes('repository'), false);
assert.equal(safeRunningActivity.includes('path'), false);
assert.equal(safeRunningActivity.includes('token'), false);

// The payload also names the tool; the point of these cases is that the public
// label never carries the result's private detail.
const resultLabel = (tool, result) => {
  const activity = getPublicToolActivity(tool, result);
  assert.equal(activity.tool, tool);
  return { label: activity.label, state: activity.state };
};
assert.deepEqual(resultLabel('runtime_status', { ok: true }), { label: 'Runtime durumu kontrol edildi', state: 'success' });
assert.deepEqual(resultLabel('agent_delegate', { ok: false, error: 'PRIVATE_INTERNAL_DETAIL' }), { label: 'Uzman ajan çalıştırılamadı', state: 'failure' });
assert.deepEqual(resultLabel('skill_invoke', { ok: true, value: { prompt: 'secret: do not leak' } }), { label: 'Hafize skill hazırlandı', state: 'success' });
assert.deepEqual(
  resultLabel('github_read_file', { ok: true, value: { repository: 'private-owner/private-repo', path: 'secret.txt', content: 'NVIDIA_API_KEY=should-never-leak' } }),
  { label: 'GitHub dosyası okundu', state: 'success' }
);
assert.equal(getPublicToolActivity('repo_delete', { ok: true }), null);

const { createBuiltinSkillsRuntimeSync } = await import('../lib/skills-runtime.ts');
const builtinSkills = createBuiltinSkillsRuntimeSync();

// Every failure also reports which tool ran and for how long. These cases are about
// the sanitized error code, so the envelope is checked once and compared on code.
const failure = (result) => {
  assert.equal(result.ok, false);
  assert.ok(typeof result.tool === 'string' && result.tool.length > 0, 'failure names its tool');
  assert.ok(Number.isInteger(result.durationMs) && result.durationMs >= 0, 'failure reports a duration');
  return result.status === undefined ? { ok: result.ok, error: result.error } : { ok: result.ok, error: result.error, status: result.status };
};

// A tool is advertised only when the runtime can actually execute it: agent_delegate
// needs a delegator, github_read_file a reader, skill_invoke a skills runtime. A
// context missing one of those must not offer the matching tool to the model.
const skillsRuntime = { resolveForAgent: () => ({ execution: 'inline', prompt: '', tools: [] }) };
const githubReadFile = async () => ({ content: '' });
const names = (agent, context) => getAllowedNvidiaTools(agent, context).map((tool) => tool.function.name);

assert.deepEqual(names(hafize, { githubReadConfigured: true, githubReadFile }), ['runtime_status']);
assert.deepEqual(names(hafize, { githubReadConfigured: true, githubReadFile, skillsRuntime }), ['runtime_status', 'skill_invoke']);
assert.deepEqual(
  names(hafize, { githubReadConfigured: true, githubReadFile, skillsRuntime, delegateAgent: async () => ({ ok: true }) }),
  ['runtime_status', 'agent_delegate', 'skill_invoke']
);
assert.deepEqual(names(reviewer, { githubReadConfigured: true, githubReadFile, skillsRuntime }), ['github_read_file', 'skill_invoke']);
assert.deepEqual(names(engineer, { githubReadConfigured: true, githubReadFile, skillsRuntime }), ['github_read_file', 'skill_invoke']);
assert.deepEqual(names(reviewer, { githubReadConfigured: false, skillsRuntime }), ['skill_invoke']);
const hafizeTools = getAllowedNvidiaTools(hafize, { githubReadConfigured: true, githubReadFile, skillsRuntime });

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
assert.deepEqual(failure(credentialBearingToolResult), { ok: false, error: 'TOOL_RESULT_CREDENTIAL_BLOCKED' });

const credentialFieldToolResult = await executeNvidiaToolCall(
  reviewer,
  { id: 'call_credential_2', type: 'function', function: { name: 'github_read_file', arguments: '{"repository":"x/y","path":"README.md"}' } },
  { traceId, agent: reviewer, registry, githubReadConfigured: true, githubReadFile: async () => ({ content: 'normal', access_token: 'opaque-secret' }), approvalGranted: false }
);
assert.deepEqual(failure(credentialFieldToolResult), { ok: false, error: 'TOOL_RESULT_CREDENTIAL_FIELD_BLOCKED' });

const accessorsToolResult = await executeNvidiaToolCall(
  reviewer,
  { id: 'call_credential_3', type: 'function', function: { name: 'github_read_file', arguments: '{"repository":"x/y","path":"README.md"}' } },
  { traceId, agent: reviewer, registry, githubReadConfigured: true, githubReadFile: async () => {
    const value = {};
    Object.defineProperty(value, 'content', { enumerable: true, get() { return 'hidden'; } });
    return value;
  }, approvalGranted: false }
);
assert.deepEqual(failure(accessorsToolResult), { ok: false, error: 'TOOL_RESULT_ACCESSOR_BLOCKED' });

const skillResult = await executeNvidiaToolCall(
  hafize,
  {
    id: 'call_skill_1',
    type: 'function',
    function: { name: 'skill_invoke', arguments: JSON.stringify({ skillId: 'runtime-diagnostics', args: { question: 'Runtime hazır mı?' } }) }
  },
  { traceId, agent: hafize, registry, skillsRuntime: builtinSkills, approvalGranted: false }
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
  { traceId, agent: reviewer, registry, githubReadConfigured: true, skillsRuntime: builtinSkills, approvalGranted: false }
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
  { traceId, agent: hafize, registry, skillsRuntime: builtinSkills, approvalGranted: false }
);
assert.equal(invalidSkillArgs.ok, false);
assert.match(invalidSkillArgs.error, /UNKNOWN_SKILL_ARGUMENT|SKILL_ARGUMENT_SECRET_MATERIAL/);

const unknownSkill = await executeNvidiaToolCall(
  hafize,
  { id: 'call_skill_4', type: 'function', function: { name: 'skill_invoke', arguments: JSON.stringify({ skillId: 'does-not-exist' }) } },
  { traceId, agent: hafize, registry, skillsRuntime: builtinSkills, approvalGranted: false }
);
assert.deepEqual(failure(unknownSkill), { ok: false, error: 'UNKNOWN_SKILL' });

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
assert.deepEqual(failure(unavailableGithub), { ok: false, error: 'TOOL_UNAVAILABLE' });

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
assert.deepEqual(failure(safeExecutionError), { ok: false, error: 'GITHUB_REPO_NOT_ALLOWED', status: 403 });
assert.equal(JSON.stringify(safeExecutionError).includes('internal detail'), false);

const unknown = await executeNvidiaToolCall(
  hafize,
  { id: 'call_7', type: 'function', function: { name: 'repo_delete', arguments: '{}' } },
  { traceId, agent: hafize, registry, nvidiaConfigured: true, approvalGranted: false }
);
assert.deepEqual(failure(unknown), { ok: false, error: 'UNKNOWN_TOOL' });

console.log('Tool runtime OK: authorization, safe activity, credential-safe egress, delegation and configured GitHub repo.read are policy-gated');
