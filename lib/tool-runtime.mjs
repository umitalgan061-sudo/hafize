import { authorizeAgentTool } from './agent-runtime.mjs';

const TOOL_CATALOG = new Map([
  [
    'runtime_status',
    {
      permission: 'runtime.status',
      definition: {
        type: 'function',
        function: {
          name: 'runtime_status',
          description: 'Hafize runtime durumunu salt-okunur olarak döndürür. Secret veya credential değeri içermez.',
          parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false
          }
        }
      },
      async execute(_args, context) {
        return {
          status: 'ok',
          traceId: context.traceId,
          agentId: context.agent.id,
          agentName: context.agent.name,
          nvidiaConfigured: Boolean(context.nvidiaConfigured),
          availableAgents: context.registry.agents.map(({ id, name, kind }) => ({ id, name, kind }))
        };
      }
    }
  ]
]);

function parseArguments(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  const value = JSON.parse(raw);
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('INVALID_TOOL_ARGUMENTS');
  return value;
}

export function getAllowedNvidiaTools(agent) {
  const tools = [];
  for (const entry of TOOL_CATALOG.values()) {
    if (authorizeAgentTool(agent, entry.permission).allowed) tools.push(entry.definition);
  }
  return tools;
}

export async function executeNvidiaToolCall(agent, toolCall, context) {
  const name = toolCall?.function?.name;
  const entry = typeof name === 'string' ? TOOL_CATALOG.get(name) : null;
  if (!entry) return { ok: false, error: 'UNKNOWN_TOOL' };

  const authorization = authorizeAgentTool(agent, entry.permission, {
    approvalGranted: Boolean(context.approvalGranted)
  });
  if (!authorization.allowed) {
    return { ok: false, error: 'TOOL_NOT_AUTHORIZED', reason: authorization.reason };
  }

  let args;
  try {
    args = parseArguments(toolCall.function.arguments);
  } catch {
    return { ok: false, error: 'INVALID_TOOL_ARGUMENTS' };
  }

  const value = await entry.execute(args, context);
  return { ok: true, value };
}

export function listToolPermissions() {
  return [...TOOL_CATALOG.values()].map(({ permission, definition }) => ({
    permission,
    functionName: definition.function.name
  }));
}
