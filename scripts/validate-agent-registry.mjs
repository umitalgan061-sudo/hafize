import { loadAgentRegistry } from '../lib/agent-runtime.mts';

const registry = await loadAgentRegistry();

console.log(`Agent registry OK: ${registry.agents.length} agents, default=${registry.defaultAgent}`);
