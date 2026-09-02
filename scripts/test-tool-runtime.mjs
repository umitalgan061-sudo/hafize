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
  { permission: 'connector.gmail.read', functionName: 'gmail_read' }
]);

assert.deepEqual(getPublicToolRunningActivity('runtime_status'), {
  label: 'Runtime durumu kontrol ediliyor',
  state: 'running'
});
assert.deepEqual(getPublicToolRunningActivity('agent_delegate'), {
  label: 'Uzman ajan çalıştırılıyor',
  state: 'running'
});
assert.deepEqual(getPublicToolRunningActivity('github_read_file'), {
  label: 'GitHub dosyası okunuyor',
  state: 'running'
});
assert.deepEqual(getPublicToolRunningActivity('canva_read'), {
  label: 'Canva verisi okunuyor',
  state: 'running'
});
assert.deepEqual(getPublicToolRunningActivity('gmail_read'), {
  label: 'Gmail verisi okunuyor',
  state: 'running'
});
assert.equal(getPublicToolRunningActivity('repo_delete'), null);
assert.equal(getPublicToolRunningActivity(null), null);
const safeRunningActivity = JSON.stringify(getPublicToolRunningActivity('github_read_file'));
assert.equal(safeRunningActivity.includes('repository'), false);
assert.equal(safeRunningActivity.includes('path'), false);
assert.equal(safeRunningActivity.includes('token'), false);

assert.deepEqual(getPublicToolActivity('runtime_status', { ok: true }), {
  label: 'Runtime durumu kontrol edildi',
  state: 'success'
});
assert.deepEqual(getPublicToolActivity('agent_delegate', { ok: false, error: 'PRIVATE_INTERNAL_DETAIL' }), {
  label: 'Uzman ajan çalıştırılamadı',
  state: 'failure'
});
assert.deepEqual(
  getPublicToolActivity('github_read_file', {
    ok: true,
    value: {
      repository: 'private-owner/private-repo',
      path: 'secret.txt',
      content: 'NVIDIA_API_KEY=should-never-leak'
    }
  }),
  { label: 'GitHub dosyası okundu', state: 'success' }
);
assert.equal(getPublicToolActivity('repo_delete', { ok: true }), null);
const safeActivity = JSON.stringify(getPublicToolActivity('github_read_file', {
  ok: false,
  error: 'GITHUB_REPO_NOT_ALLOWED',
  value: { repository: 'secret/repo', path: '.env', token: 'super-secret-token' }
}));
assert.equal(safeActivity.includes('secret/repo'), false);
assert.equal(safeActivity.includes('.env'), false);
assert.equal(safeActivity.includes('super-secret-token'), false);
assert.equal(safeActivity.includes('GITHUB_REPO_NOT_ALLOWED'), false);
assert.equal(safeActivity.includes('"state":"failure"'), true);

const safeConnectorActivity = JSON.stringify([
  getPublicToolActivity('canva_read', {
    ok: true,
    value: { designId: 'DAF-private-design', title: 'Gizli sunum', accessToken: 'canva-access-token' }
  }),
  getPublicToolActivity('gmail_read', {
    ok: false,
    error: 'GMAIL_SCOPE_NOT_ALLOWED',
    value: { messageId: 'msg-private', subject: 'Banka şifresi', refreshToken: 'gmail-refresh-token' }
  })
]);
assert.equal(safeConnectorActivity.includes('DAF-private-design'), false);
assert.equal(safeConnectorActivity.includes('Gizli sunum'), false);
assert.equal(safeConnectorActivity.includes('canva-access-token'), false);
assert.equal(safeConnectorActivity.includes('msg-private'), false);
assert.equal(safeConnectorActivity.includes('Banka şifresi'), false);
assert.equal(safeConnectorActivity.includes('gmail-refresh-token'), false);
assert.equal(safeConnectorActivity.includes('GMAIL_SCOPE_NOT_ALLOWED'), false);
assert.deepEqual(getPublicToolActivity('canva_read', { ok: true }), {
  label: 'Canva verisi okundu',
  state: 'success'
});
assert.deepEqual(getPublicToolActivity('gmail_read', { ok: false }), {
  label: 'Gmail verisi okunamadı',
  state: 'failure'
});

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

const connectorContext = {
  canvaReadAuthenticated: true,
  canvaReadTool: { execute: async () => ({}) },
  gmailReadAuthenticated: true,
  gmailReadTool: { execute: async () => ({}) }
};
assert.deepEqual(
  getAllowedNvidiaTools(hafize, connectorContext).map((tool) => tool.function.name),
  ['runtime_status', 'canva_read', 'gmail_read']
);
assert.deepEqual(
  getAllowedNvidiaTools(hafize, { ...connectorContext, canvaReadAuthenticated: false }).map(
    (tool) => tool.function.name
  ),
  ['runtime_status', 'gmail_read']
);
assert.deepEqual(
  getAllowedNvidiaTools(hafize, { ...connectorContext, gmailReadTool: null }).map(
    (tool) => tool.function.name
  ),
  ['runtime_status', 'canva_read']
);
assert.deepEqual(
  getAllowedNvidiaTools(reviewer, { ...connectorContext, githubReadConfigured: true }).map(
    (tool) => tool.function.name
  ),
  ['github_read_file']
);

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

const unauthenticatedGmail = await executeNvidiaToolCall(
  hafize,
  {
    id: 'call_8',
    type: 'function',
    function: { name: 'gmail_read', arguments: JSON.stringify({ operation: 'profile' }) }
  },
  { traceId, agent: hafize, registry, gmailReadAuthenticated: false, gmailReadTool: { execute: async () => ({}) } }
);
assert.deepEqual(unauthenticatedGmail, { ok: false, error: 'TOOL_UNAVAILABLE' });

const unauthorizedCanva = await executeNvidiaToolCall(
  reviewer,
  {
    id: 'call_9',
    type: 'function',
    function: { name: 'canva_read', arguments: JSON.stringify({ operation: 'profile' }) }
  },
  { traceId, agent: reviewer, registry, ...connectorContext }
);
assert.equal(unauthorizedCanva.ok, false);
assert.equal(unauthorizedCanva.error, 'TOOL_NOT_AUTHORIZED');

const safeConnectorError = await executeNvidiaToolCall(
  hafize,
  {
    id: 'call_10',
    type: 'function',
    function: { name: 'gmail_read', arguments: JSON.stringify({ operation: 'profile' }) }
  },
  {
    traceId,
    agent: hafize,
    registry,
    gmailReadAuthenticated: true,
    gmailReadTool: {
      execute: async () => {
        const error = new Error('refresh_token=gmail-refresh-token expired for user@example.com');
        error.code = 'GMAIL_OPERATION_NOT_ALLOWED';
        error.status = 403;
        throw error;
      }
    }
  }
);
assert.deepEqual(safeConnectorError, { ok: false, error: 'GMAIL_OPERATION_NOT_ALLOWED', status: 403 });
assert.equal(JSON.stringify(safeConnectorError).includes('gmail-refresh-token'), false);
assert.equal(JSON.stringify(safeConnectorError).includes('user@example.com'), false);

const unknown = await executeNvidiaToolCall(
  hafize,
  { id: 'call_7', type: 'function', function: { name: 'repo_delete', arguments: '{}' } },
  { traceId, agent: hafize, registry, nvidiaConfigured: true, approvalGranted: false }
);
assert.deepEqual(unknown, { ok: false, error: 'UNKNOWN_TOOL' });

console.log('Tool runtime OK: safe state-based running/terminal activity, runtime status, delegation, configured GitHub repo.read and authenticated Canva/Gmail connector reads are policy-gated');
