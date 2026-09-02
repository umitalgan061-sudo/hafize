import { loadAgentRegistry } from '../lib/agent-runtime.mjs';
import { auditAgentToolPolicies } from '../lib/agent-tool-audit.mjs';
import { listToolPermissions } from '../lib/tool-runtime.mjs';

const registry = await loadAgentRegistry();
const audit = auditAgentToolPolicies(registry, listToolPermissions());
if (audit.problems.length) {
  console.error(`Agent registry FAIL:\n  ${audit.problems.join('\n  ')}`);
  process.exit(1);
}

console.log(
  `Agent registry OK: ${registry.agents.length} agents, default=${registry.defaultAgent}, ` +
  `${audit.tools} tools reachable`
);
