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

// Katalogdaki her araç, iç detay sızdırmayan running/success/failure etiketleri taşımalıdır.
// Yeni bir araç etiketsiz kaydedilirse bu döngü kırmızıya döner.
for (const { functionName } of listToolPermissions()) {
  const running = getPublicToolRunningActivity(functionName);
  assert.equal(running?.state, 'running', `${functionName} running etiketi eksik`);
  assert.equal(typeof running.label, 'string');
  assert.ok(running.label.length > 0);

  const success = getPublicToolActivity(functionName, { ok: true, value: { token: 'super-secret-token' } });
  assert.equal(success?.state, 'success', `${functionName} success etiketi eksik`);
  assert.deepEqual(Object.keys(success).sort(), ['label', 'state']);

  const failure = getPublicToolActivity(functionName, { ok: false, error: 'PRIVATE_INTERNAL_DETAIL' });
  assert.equal(failure?.state, 'failure', `${functionName} failure etiketi eksik`);
  assert.deepEqual(Object.keys(failure).sort(), ['label', 'state']);
  assert.equal(JSON.stringify([running, success, failure]).includes('PRIVATE_INTERNAL_DETAIL'), false);
  assert.equal(JSON.stringify([running, success, failure]).includes('super-secret-token'), false);
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

// Connector araçları yalnızca kimliği doğrulanmış bağlantı + çalıştırılabilir boundary varken sunulur.
const canvaContext = {
  canvaReadAuthenticated: true,
  canvaReadTool: { execute: async () => ({ operation: 'user.get' }) }
};
const gmailContext = {
  gmailReadAuthenticated: true,
  gmailReadTool: { execute: async () => ({ operation: 'profile.get' }) }
};
assert.deepEqual(
  getAllowedNvidiaTools(hafize, { ...canvaContext, ...gmailContext }).map((tool) => tool.function.name),
  ['runtime_status', 'canva_read', 'gmail_read']
);
assert.deepEqual(
  getAllowedNvidiaTools(hafize, { canvaReadAuthenticated: false, canvaReadTool: canvaContext.canvaReadTool })
    .map((tool) => tool.function.name),
  ['runtime_status']
);
assert.deepEqual(
  getAllowedNvidiaTools(hafize, { gmailReadAuthenticated: true }).map((tool) => tool.function.name),
  ['runtime_status']
);
// Bağlantı izni olmayan uzman ajan, bağlantı doğrulanmış olsa bile connector araçlarını görmez.
assert.deepEqual(
  getAllowedNvidiaTools(reviewer, { ...canvaContext, ...gmailContext, githubReadConfigured: true })
    .map((tool) => tool.function.name),
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

const canvaCall = {
  id: 'call_canva',
  type: 'function',
  function: { name: 'canva_read', arguments: JSON.stringify({ operation: 'user.get' }) }
};
const gmailCall = {
  id: 'call_gmail',
  type: 'function',
  function: { name: 'gmail_read', arguments: JSON.stringify({ operation: 'profile.get' }) }
};

const canvaResult = await executeNvidiaToolCall(hafize, canvaCall, {
  traceId,
  agent: hafize,
  registry,
  ...canvaContext
});
assert.deepEqual(canvaResult, { ok: true, value: { operation: 'user.get' } });

const gmailResult = await executeNvidiaToolCall(hafize, gmailCall, {
  traceId,
  agent: hafize,
  registry,
  ...gmailContext
});
assert.deepEqual(gmailResult, { ok: true, value: { operation: 'profile.get' } });

// Bağlantı doğrulanmamışsa araç hiç çalıştırılmaz.
let canvaExecuted = false;
const unauthenticatedCanva = await executeNvidiaToolCall(hafize, canvaCall, {
  traceId,
  agent: hafize,
  registry,
  canvaReadAuthenticated: false,
  canvaReadTool: {
    execute: async () => {
      canvaExecuted = true;
      return {};
    }
  }
});
assert.deepEqual(unauthenticatedCanva, { ok: false, error: 'TOOL_UNAVAILABLE' });
assert.equal(canvaExecuted, false);

// İzin verilmemiş ajan, bağlantı hazır olsa bile connector aracını çalıştıramaz.
let gmailExecuted = false;
const deniedGmail = await executeNvidiaToolCall(reviewer, gmailCall, {
  traceId,
  agent: reviewer,
  registry,
  gmailReadAuthenticated: true,
  gmailReadTool: {
    execute: async () => {
      gmailExecuted = true;
      return {};
    }
  }
});
assert.equal(deniedGmail.ok, false);
assert.equal(deniedGmail.error, 'TOOL_NOT_AUTHORIZED');
assert.equal(gmailExecuted, false);

// Boundary hatası iç detay değil, yalnızca kod olarak dışarı verilir.
const canvaBoundaryError = await executeNvidiaToolCall(hafize, canvaCall, {
  traceId,
  agent: hafize,
  registry,
  canvaReadAuthenticated: true,
  canvaReadTool: {
    execute: async () => {
      const error = new Error('canva refresh token leaked-detail');
      error.code = 'INVALID_CANVA_READ_TOOL';
      error.status = 400;
      throw error;
    }
  }
});
assert.deepEqual(canvaBoundaryError, { ok: false, error: 'INVALID_CANVA_READ_TOOL', status: 400 });
assert.equal(JSON.stringify(canvaBoundaryError).includes('leaked-detail'), false);

const unknown = await executeNvidiaToolCall(
  hafize,
  { id: 'call_7', type: 'function', function: { name: 'repo_delete', arguments: '{}' } },
  { traceId, agent: hafize, registry, nvidiaConfigured: true, approvalGranted: false }
);
assert.deepEqual(unknown, { ok: false, error: 'UNKNOWN_TOOL' });

console.log('Tool runtime OK: full catalog permissions, safe state-based activity for every tool, runtime status, delegation, configured GitHub repo.read, and authenticated Canva/Gmail read are policy-gated');
