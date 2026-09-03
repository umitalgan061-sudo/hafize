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
assert.equal(
  listToolPermissions().some(({ functionName }) => functionName === 'gmail_send'),
  false,
  'gmail_send must stay out of the model-callable catalog'
);

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

for (const [functionName, running, success, failure] of [
  ['canva_read', 'Canva verisi okunuyor', 'Canva verisi okundu', 'Canva verisi okunamadı'],
  ['gmail_read', 'Gmail verisi okunuyor', 'Gmail verisi okundu', 'Gmail verisi okunamadı']
]) {
  assert.deepEqual(getPublicToolRunningActivity(functionName), { label: running, state: 'running' });
  assert.deepEqual(getPublicToolActivity(functionName, { ok: true, value: { subject: 'private subject' } }), {
    label: success,
    state: 'success'
  });
  assert.deepEqual(getPublicToolActivity(functionName, { ok: false, error: 'CONNECTOR_REAUTH_REQUIRED' }), {
    label: failure,
    state: 'failure'
  });
  const connectorActivity = JSON.stringify(
    getPublicToolActivity(functionName, {
      ok: true,
      value: { subject: 'private subject', accessToken: 'super-secret-token', from: 'owner@example.com' }
    })
  );
  assert.equal(connectorActivity.includes('private subject'), false);
  assert.equal(connectorActivity.includes('super-secret-token'), false);
  assert.equal(connectorActivity.includes('owner@example.com'), false);
}

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
  canvaReadTool: { execute: async () => ({ designs: [] }) },
  gmailReadAuthenticated: true,
  gmailReadTool: { execute: async () => ({ messages: [] }) }
};
assert.deepEqual(
  getAllowedNvidiaTools(hafize, connectorContext).map((tool) => tool.function.name),
  ['runtime_status', 'canva_read', 'gmail_read']
);
assert.deepEqual(
  getAllowedNvidiaTools(hafize, { ...connectorContext, canvaReadAuthenticated: false, gmailReadAuthenticated: false })
    .map((tool) => tool.function.name),
  ['runtime_status'],
  'connector tools stay hidden until the owner is authenticated'
);
assert.deepEqual(
  getAllowedNvidiaTools(reviewer, { ...connectorContext, githubReadConfigured: true }).map((tool) => tool.function.name),
  ['github_read_file'],
  'connector tools follow agent permissions, not connector availability'
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

const gmailReadResult = await executeNvidiaToolCall(
  hafize,
  { id: 'call_8', type: 'function', function: { name: 'gmail_read', arguments: '{"operation":"message.list"}' } },
  { traceId, agent: hafize, registry, ...connectorContext }
);
assert.deepEqual(gmailReadResult, { ok: true, value: { messages: [] } });

const unauthenticatedGmail = await executeNvidiaToolCall(
  hafize,
  { id: 'call_9', type: 'function', function: { name: 'gmail_read', arguments: '{"operation":"message.list"}' } },
  { traceId, agent: hafize, registry, ...connectorContext, gmailReadAuthenticated: false }
);
assert.deepEqual(unauthenticatedGmail, { ok: false, error: 'TOOL_UNAVAILABLE' });

const deniedCanva = await executeNvidiaToolCall(
  reviewer,
  { id: 'call_10', type: 'function', function: { name: 'canva_read', arguments: '{"operation":"user.get"}' } },
  { traceId, agent: reviewer, registry, ...connectorContext }
);
assert.equal(deniedCanva.ok, false);
assert.equal(deniedCanva.error, 'TOOL_NOT_AUTHORIZED');

const gmailSend = await executeNvidiaToolCall(
  hafize,
  { id: 'call_11', type: 'function', function: { name: 'gmail_send', arguments: '{}' } },
  { traceId, agent: hafize, registry, ...connectorContext, approvalGranted: true }
);
assert.deepEqual(gmailSend, { ok: false, error: 'UNKNOWN_TOOL' });

const unknown = await executeNvidiaToolCall(
  hafize,
  { id: 'call_7', type: 'function', function: { name: 'repo_delete', arguments: '{}' } },
  { traceId, agent: hafize, registry, nvidiaConfigured: true, approvalGranted: false }
);
assert.deepEqual(unknown, { ok: false, error: 'UNKNOWN_TOOL' });

console.log('Tool runtime OK: safe state-based running/terminal activity, runtime status, delegation, configured GitHub repo.read, and authenticated Canva/Gmail read tools are policy-gated');
