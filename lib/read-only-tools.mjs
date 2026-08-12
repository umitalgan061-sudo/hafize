import { listPublicAgents } from './agent-runtime.mjs';

export const READ_ONLY_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'runtime.list_agents',
      description: 'Hafize runtime içinde kullanılabilen ajanların güvenli, herkese açık metadata listesini getirir.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false
      }
    }
  }
];

export function getToolDefinition(name) {
  return READ_ONLY_TOOL_DEFINITIONS.find((tool) => tool.function.name === name) || null;
}

export function executeReadOnlyTool(name, args, { registry, traceId }) {
  if (name !== 'runtime.list_agents') throw new Error('UNKNOWN_READ_ONLY_TOOL');
  if (args && typeof args === 'object' && Object.keys(args).length > 0) throw new Error('INVALID_TOOL_ARGUMENTS');

  return {
    trace_id: traceId,
    defaultAgent: registry.defaultAgent,
    agents: listPublicAgents(registry)
  };
}
