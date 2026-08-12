import assert from 'node:assert/strict';
import {
  authorizeAgentTool,
  createTraceId,
  loadAgentRegistry,
  resolveAgent
} from '../lib/agent-runtime.mjs';
import {
  READ_ONLY_TOOL_DEFINITIONS,
  executeReadOnlyTool
} from '../lib/read-only-tools.mjs';

const registry = await loadAgentRegistry();
const hafize = resolveAgent(registry, 'hafize-general');
const reviewer = resolveAgent(registry, 'agency-code-reviewer');
const toolName = READ_ONLY_TOOL_DEFINITIONS[0]?.function?.name;

assert.equal(toolName, 'runtime.list_agents');
assert.deepEqual(authorizeAgentTool(hafize, toolName), { allowed: true, reason: 'allowlisted' });
assert.deepEqual(authorizeAgentTool(reviewer, toolName), { allowed: false, reason: 'default_deny' });
assert.deepEqual(authorizeAgentTool(hafize, 'repo.merge'), { allowed: false, reason: 'approval_required' });

const traceId = createTraceId();
const result = executeReadOnlyTool(toolName, {}, { registry, traceId });
assert.equal(result.trace_id, traceId);
assert.equal(result.defaultAgent, registry.defaultAgent);
assert.equal(result.agents.length, registry.agents.length);
assert.ok(result.agents.every((agent) => !('toolPolicy' in agent)));
assert.ok(JSON.stringify(result).includes('Hafize'));
assert.ok(!JSON.stringify(result).includes('secret.read'));

assert.throws(
  () => executeReadOnlyTool(toolName, { unexpected: true }, { registry, traceId }),
  /INVALID_TOOL_ARGUMENTS/
);
assert.throws(
  () => executeReadOnlyTool('repo.merge', {}, { registry, traceId }),
  /UNKNOWN_READ_ONLY_TOOL/
);

console.log('Read-only tool runtime OK');
