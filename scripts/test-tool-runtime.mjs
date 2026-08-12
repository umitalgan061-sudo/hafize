import assert from 'node:assert/strict';
import { loadAgentRegistry, resolveAgent } from '../lib/agent-runtime.mjs';
import { executeNvidiaToolCall, getAllowedNvidiaTools, listToolPermissions } from '../lib/tool-runtime.mjs';

const registry = await loadAgentRegistry();
const hafize = resolveAgent(registry, 'hafize-general');
const reviewer = resolveAgent(registry, 'agency-code-reviewer');

assert.ok(hafize);
assert.ok(reviewer);
assert.deepEqual(listToolPermissions(), [{ permission: 'runtime.status', functionName: 'runtime_status' }]);

const hafizeTools = getAllowedNvidiaTools(hafize);
assert.equal(hafizeTools.length, 1);
assert.equal(hafizeTools[0].function.name, 'runtime_status');
assert.equal(getAllowedNvidiaTools(reviewer).length, 0);

const traceId = '00000000-0000-4000-8000-000000000001';
const result = await executeNvidiaToolCall(
  hafize,
  { id: 'call_1', type: 'function', function: { name: 'runtime_status', arguments: '{}' } },
  { traceId, agent: hafize, registry, nvidiaConfigured: true, approvalGranted: false }
);
assert.equal(result.ok, true);
assert.equal(result.value.traceId, traceId);
assert.equal(result.value.agentId, 'hafize-general');
assert.equal(result.value.nvidiaConfigured, true);
assert.ok(Array.isArray(result.value.availableAgents));
assert.equal(JSON.stringify(result).includes('NVIDIA_API_KEY'), false);

const denied = await executeNvidiaToolCall(
  reviewer,
  { id: 'call_2', type: 'function', function: { name: 'runtime_status', arguments: '{}' } },
  { traceId, agent: reviewer, registry, nvidiaConfigured: true, approvalGranted: false }
);
assert.equal(denied.ok, false);
assert.equal(denied.error, 'TOOL_NOT_AUTHORIZED');

const unknown = await executeNvidiaToolCall(
  hafize,
  { id: 'call_3', type: 'function', function: { name: 'repo_delete', arguments: '{}' } },
  { traceId, agent: hafize, registry, nvidiaConfigured: true, approvalGranted: false }
);
assert.deepEqual(unknown, { ok: false, error: 'UNKNOWN_TOOL' });

console.log('Tool runtime OK: read-only runtime_status is policy-gated');
