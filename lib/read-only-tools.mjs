import { listPublicAgents } from './agent-runtime.mjs';

const TOOL_PERMISSION_BY_NAME = new Map([
  ['runtime_list_agents', 'runtime.list_agents']
]);

export const READ_ONLY_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'runtime_list_agents',
      description: 'Hafize runtime içinde kullanılabilen ajanların güvenli, herkese açık metadata listesini getirir.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false
      }
    }
  }
];

export function getToolPermission(name) {
  return TOOL_PERMISSION_BY_NAME.get(name) || null;
}

export function executeReadOnlyTool(name, args, { registry, traceId }) {
  if (name !== 'runtime_list_agents') throw new Error('UNKNOWN_READ_ONLY_TOOL');
  if (args && typeof args === 'object' && Object.keys(args).length > 0) throw new Error('INVALID_TOOL_ARGUMENTS');

  return {
    trace_id: traceId,
    defaultAgent: registry.defaultAgent,
    agents: listPublicAgents(registry)
  };
}
