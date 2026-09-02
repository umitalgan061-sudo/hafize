import assert from 'node:assert/strict';
import { loadAgentRegistry } from '../lib/agent-runtime.mjs';
import { auditAgentToolPolicies } from '../lib/agent-tool-audit.mjs';
import { listToolPermissions } from '../lib/tool-runtime.mjs';

const catalog = [
  { permission: 'runtime.status', functionName: 'runtime_status' },
  { permission: 'connector.gmail.read', functionName: 'gmail_read' }
];

function agent(id, toolPolicy) {
  return { id, name: id, description: id, toolPolicy: { default: 'deny', ...toolPolicy } };
}

// Depodaki gerçek registry ile katalog tutarlı olmalı.
const liveAudit = auditAgentToolPolicies(await loadAgentRegistry(), listToolPermissions());
assert.deepEqual(liveAudit.problems, []);
assert.ok(liveAudit.tools > 0);

const healthy = auditAgentToolPolicies(
  { agents: [agent('a', { allow: ['runtime.status', 'connector.gmail.read', 'task.read'] })] },
  catalog
);
assert.deepEqual(healthy.problems, []);
assert.equal(healthy.tools, 2);

// Yazım hatalı connector izni yakalanmalı.
const typo = auditAgentToolPolicies(
  { agents: [agent('a', { allow: ['runtime.status', 'connector.gmail.raed', 'connector.gmail.read'] })] },
  catalog
);
assert.deepEqual(typo.problems, ['UNKNOWN_CONNECTOR_PERMISSION:a:connector.gmail.raed']);

// Hiçbir ajana verilmemiş araç erişilemez sayılmalı.
const unreachable = auditAgentToolPolicies({ agents: [agent('a', { allow: ['runtime.status'] })] }, catalog);
assert.deepEqual(unreachable.problems, ['UNREACHABLE_TOOL:gmail_read:connector.gmail.read']);

// approvalRequired de erişim sayılır; deny tek başına izin üretmez.
const approvalOnly = auditAgentToolPolicies(
  { agents: [agent('a', { allow: ['runtime.status'], approvalRequired: ['connector.gmail.read'] })] },
  catalog
);
assert.deepEqual(approvalOnly.problems, []);
const denyOnly = auditAgentToolPolicies(
  { agents: [agent('a', { allow: ['runtime.status'], deny: ['connector.gmail.read'] })] },
  catalog
);
assert.deepEqual(denyOnly.problems, ['UNREACHABLE_TOOL:gmail_read:connector.gmail.read']);

// Bozuk girdi sessizce geçmemeli.
assert.throws(() => auditAgentToolPolicies(null, catalog), /INVALID_AGENT_TOOL_AUDIT:registry/);
assert.throws(() => auditAgentToolPolicies({ agents: [] }, null), /INVALID_AGENT_TOOL_AUDIT:toolPermissions/);

console.log('agent tool audit tests passed');
