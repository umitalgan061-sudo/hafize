import { authorizeAgentTool } from './agent-runtime.mjs';
import { CANVA_READ_TOOL_DEFINITION } from './canva-read-tool-boundary.mjs';

const TOOL_CATALOG = new Map([
  [
    'runtime_status',
    {
      permission: 'runtime.status',
      publicActivity: {
        running: 'Runtime durumu kontrol ediliyor',
        success: 'Runtime durumu kontrol edildi',
        failure: 'Runtime durumu kontrol edilemedi'
      },
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
          githubReadConfigured: Boolean(context.githubReadConfigured),
          availableAgents: context.registry.agents.map(({ id, name, kind }) => ({ id, name, kind }))
        };
      }
    }
  ],
  [
    'agent_delegate',
    {
      permission: 'agent.delegate',
      publicActivity: {
        running: 'Uzman ajan çalıştırılıyor',
        success: 'Uzman ajan çalıştırıldı',
        failure: 'Uzman ajan çalıştırılamadı'
      },
      available(context) {
        return typeof context.delegateAgent === 'function';
      },
      definition: {
        type: 'function',
        function: {
          name: 'agent_delegate',
          description: 'Dar kapsamlı bir görevi registry içindeki uzman bir Hafize ajanına delege eder. Backend depth/fan-out ve uzman sınırlarını zorunlu uygular.',
          parameters: {
            type: 'object',
            properties: {
              agentId: {
                type: 'string',
                description: 'Hedef specialist agent kimliği.'
              },
              task: {
                type: 'string',
                description: 'Uzman ajanın çözmesi gereken dar kapsamlı görev.'
              },
              successCriteria: {
                type: 'array',
                description: 'Görevin tamamlanmış sayılması için gözlenebilir başarı ölçütleri.',
                maxItems: 8,
                items: { type: 'string', maxLength: 500 }
              },
              constraints: {
                type: 'array',
                description: 'Uzman ajanın görev sırasında aşmaması gereken kapsam veya davranış sınırları.',
                maxItems: 8,
                items: { type: 'string', maxLength: 500 }
              },
              evidenceRequired: {
                type: 'array',
                description: 'Uzman sonucun doğrulanması için beklenen kanıt veya kontrol maddeleri.',
                maxItems: 8,
                items: { type: 'string', maxLength: 500 }
              }
            },
            required: ['agentId', 'task'],
            additionalProperties: false
          }
        }
      },
      async execute(args, context) {
        const result = await context.delegateAgent(args);
        if (!result?.ok) {
          const error = new Error('AGENT_DELEGATION_FAILED');
          error.code = typeof result?.error === 'string' ? result.error : 'AGENT_DELEGATION_FAILED';
          throw error;
        }
        return result.value;
      }
    }
  ],
  [
    'github_read_file',
    {
      permission: 'repo.read',
      publicActivity: {
        running: 'GitHub dosyası okunuyor',
        success: 'GitHub dosyası okundu',
        failure: 'GitHub dosyası okunamadı'
      },
      available(context) {
        return Boolean(context.githubReadConfigured);
      },
      definition: {
        type: 'function',
        function: {
          name: 'github_read_file',
          description: 'İzin verilen bir GitHub reposundaki tek bir metin dosyasını salt-okunur olarak getirir. Secret benzeri yollar backend tarafından engellenir.',
          parameters: {
            type: 'object',
            properties: {
              repository: {
                type: 'string',
                description: 'owner/repo biçiminde GitHub deposu.'
              },
              path: {
                type: 'string',
                description: 'Repo içindeki göreli metin dosyası yolu.'
              },
              ref: {
                type: 'string',
                description: 'Opsiyonel branch, tag veya commit ref.'
              }
            },
            required: ['repository', 'path'],
            additionalProperties: false
          }
        }
      },
      async execute(args, context) {
        if (typeof context.githubReadFile !== 'function') {
          const error = new Error('GITHUB_NOT_CONFIGURED');
          error.code = 'GITHUB_NOT_CONFIGURED';
          error.status = 503;
          throw error;
        }
        return context.githubReadFile(args);
      }
    }
  ],
  [
    'canva_read',
    {
      permission: 'connector.canva.read',
      publicActivity: {
        running: 'Canva verisi okunuyor',
        success: 'Canva verisi okundu',
        failure: 'Canva verisi okunamadı'
      },
      available(context) {
        return context.canvaReadAuthenticated === true && typeof context.canvaReadTool?.execute === 'function';
      },
      definition: CANVA_READ_TOOL_DEFINITION,
      async execute(args, context) {
        return context.canvaReadTool.execute(args);
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

export function getAllowedNvidiaTools(agent, context = {}) {
  const tools = [];
  for (const entry of TOOL_CATALOG.values()) {
    if (typeof entry.available === 'function' && !entry.available(context)) continue;
    if (authorizeAgentTool(agent, entry.permission).allowed) tools.push(entry.definition);
  }
  return tools;
}

export function getPublicToolRunningActivity(functionName) {
  const entry = typeof functionName === 'string' ? TOOL_CATALOG.get(functionName) : null;
  if (!entry?.publicActivity?.running) return null;
  return {
    label: entry.publicActivity.running,
    state: 'running'
  };
}

export function getPublicToolActivity(functionName, result) {
  const entry = typeof functionName === 'string' ? TOOL_CATALOG.get(functionName) : null;
  if (!entry?.publicActivity) return null;
  const state = result?.ok === true ? 'success' : 'failure';
  return {
    label: entry.publicActivity[state],
    state
  };
}

export async function executeNvidiaToolCall(agent, toolCall, context) {
  const name = toolCall?.function?.name;
  const entry = typeof name === 'string' ? TOOL_CATALOG.get(name) : null;
  if (!entry) return { ok: false, error: 'UNKNOWN_TOOL' };
  if (typeof entry.available === 'function' && !entry.available(context)) {
    return { ok: false, error: 'TOOL_UNAVAILABLE' };
  }

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

  try {
    const value = await entry.execute(args, context);
    return { ok: true, value };
  } catch (error) {
    const result = {
      ok: false,
      error: typeof error?.code === 'string' && error.code ? error.code : 'TOOL_EXECUTION_FAILED'
    };
    if (Number.isInteger(error?.status)) result.status = error.status;
    return result;
  }
}

export function listToolPermissions() {
  return [...TOOL_CATALOG.values()].map(({ permission, definition }) => ({
    permission,
    functionName: definition.function.name
  }));
}
