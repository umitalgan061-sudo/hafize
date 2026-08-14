import { loadAgentRegistry } from '../lib/agent-runtime.mjs';

const registry = await loadAgentRegistry();

console.log(`Agent registry OK: ${registry.agents.length} agents, default=${registry.defaultAgent}`);
