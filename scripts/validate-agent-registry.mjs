import fs from 'node:fs';

const file = new URL('../agents/registry.json', import.meta.url);
const registry = JSON.parse(fs.readFileSync(file, 'utf8'));

if (registry.schemaVersion !== 1) throw new Error('Unsupported agent registry schemaVersion');
if (!Array.isArray(registry.agents) || registry.agents.length === 0) throw new Error('Agent registry is empty');

const ids = registry.agents.map((agent) => agent.id);
if (new Set(ids).size !== ids.length) throw new Error('Agent ids must be unique');
if (!ids.includes(registry.defaultAgent)) throw new Error('defaultAgent must reference an existing agent');

const forbiddenAutomaticTools = new Set(['secret.read', 'repo.delete', 'repo.merge', 'external.send']);
for (const agent of registry.agents) {
  if (!agent.id || !agent.name || !agent.description) throw new Error(`Invalid agent metadata: ${agent.id || '<missing id>'}`);
  if (agent.toolPolicy?.default !== 'deny') throw new Error(`${agent.id} must use default-deny tool policy`);

  for (const tool of agent.toolPolicy?.allow || []) {
    if (forbiddenAutomaticTools.has(tool)) throw new Error(`${agent.id} automatically allows forbidden tool: ${tool}`);
  }
}

console.log(`Agent registry OK: ${registry.agents.length} agents, default=${registry.defaultAgent}`);
