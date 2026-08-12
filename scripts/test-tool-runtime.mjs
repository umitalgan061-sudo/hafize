import assert from 'node:assert/strict';
import { loadAgentRegistry, resolveAgent } from '../lib/agent-runtime.mjs';
import { executeNvidiaToolCall, getAllowedNvidiaTools, listToolPermissions } from '../lib/tool-runtime.mjs';

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
  { permission: 'repo.read', functionName: 'github_read_file' }
]);

const hafizeTools = getAllowedNvidiaTools(hafize, { githubReadConfigured: true });
assert.deepEqual(hafizeTools.map((tool) => tool.function.name), ['runtime_status']);
assert.deepEqual(
  getAllowedNvidiaTools(reviewer, { githubReadConfigured: true }).map((tool) => tool.function.name),
  ['github_read_file']
);
assert.deepEqual(
  getAllowedNvidiaTools(engineer, { githubReadConfigured: true }).map((tool) => tool.function.name),
  ['github_read_file']
);
assert.deepEqual(getAllowedNvidiaTools(reviewer, { githubReadConfigured: false }), []);

const traceId = '00000000-0000-4000-8000-000000000001';
const result = await executeNvidiaToolCall(
  hafize,
  { id: 'call_1', type: 'function', function: { name: 'runtime_status', arguments: '{}' } },
  {
    traceId,
    agent: hafize,
    registry,
    nvidiaConfigured: true,
    githubReadConfigured: true,
    approvalGranted: false
  }
);
assert.equal(result.ok, true);
assert.equal(result.value.traceId, traceId);
assert.equal(result.value.agentId, 'hafize-general');
assert.equal(result.value.nvidiaConfigured, true);
assert.equal(result.value.githubReadConfigured, true);
assert.ok(Array.isArray(result.value.availableAgents));
assert.equal(JSON.stringify(result).includes('NVIDIA_API_KEY'), false);

const deniedRuntime = await executeNvidiaToolCall(
  reviewer,
  { id: 'call_2', type: 'function', function: { name: 'runtime_status', arguments: '{}' } },
  { traceId, agent: reviewer, registry, nvidiaConfigured: true, githubReadConfigured: true, approvalGranted: false }
);
assert.equal(deniedRuntime.ok, false);
assert.equal(deniedRuntime.error, 'TOOL_NOT_AUTHORIZED');

const githubResult = await executeNvidiaToolCall(
  reviewer,
  {
    id: 'call_3',
    type: 'function',
    function: {
      name: 'github_read_file',
      arguments: JSON.stringify({ repository: 'umitalgan061-sudo/hafize', path: 'README.md' })
    }
  },
  {
    traceId,
    agent: reviewer,
    registry,
    nvidiaConfigured: true,
    githubReadConfigured: true,
    githubReadFile: async (args) => ({ ...args, content: '# Hafize', truncated: false }),
    approvalGranted: false
  }
);
assert.equal(githubResult.ok, true);
assert.equal(githubResult.value.repository, 'umitalgan061-sudo/hafize');
assert.equal(githubResult.value.content, '# Hafize');

const unavailableGithub = await executeNvidiaToolCall(
  reviewer,
  {
    id: 'call_4',
    type: 'function',
    function: { name: 'github_read_file', arguments: '{"repository":"x/y","path":"README.md"}' }
  },
  { traceId, agent: reviewer, registry, githubReadConfigured: false }
);
assert.deepEqual(unavailableGithub, { ok: false, error: 'TOOL_UNAVAILABLE' });

const deniedGithub = await executeNvidiaToolCall(
  hafize,
  {
    id: 'call_5',
    type: 'function',
    function: { name: 'github_read_file', arguments: '{"repository":"x/y","path":"README.md"}' }
  },
  {
    traceId,
    agent: hafize,
    registry,
    githubReadConfigured: true,
    githubReadFile: async () => ({})
  }
);
assert.equal(deniedGithub.ok, false);
assert.equal(deniedGithub.error, 'TOOL_NOT_AUTHORIZED');

const safeExecutionError = await executeNvidiaToolCall(
  reviewer,
  {
    id: 'call_6',
    type: 'function',
    function: { name: 'github_read_file', arguments: '{"repository":"x/y","path":"README.md"}' }
  },
  {
    traceId,
    agent: reviewer,
    registry,
    githubReadConfigured: true,
    githubReadFile: async () => {
      const error = new Error('do not expose this internal detail');
      error.code = 'GITHUB_REPO_NOT_ALLOWED';
      error.status = 403;
      throw error;
    }
  }
);
assert.deepEqual(safeExecutionError, { ok: false, error: 'GITHUB_REPO_NOT_ALLOWED', status: 403 });
assert.equal(JSON.stringify(safeExecutionError).includes('internal detail'), false);

const unknown = await executeNvidiaToolCall(
  hafize,
  { id: 'call_7', type: 'function', function: { name: 'repo_delete', arguments: '{}' } },
  { traceId, agent: hafize, registry, nvidiaConfigured: true, approvalGranted: false }
);
assert.deepEqual(unknown, { ok: false, error: 'UNKNOWN_TOOL' });

console.log('Tool runtime OK: runtime status, delegation, and configured GitHub repo.read are policy-gated');
