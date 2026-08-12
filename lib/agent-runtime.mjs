import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const DEFAULT_REGISTRY_URL = new URL('../agents/registry.json', import.meta.url);

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`INVALID_AGENT_REGISTRY:${label}`);
  return value.trim();
}

export async function loadAgentRegistry(fileUrl = DEFAULT_REGISTRY_URL) {
  const registry = JSON.parse(await readFile(fileUrl, 'utf8'));
  if (registry?.schemaVersion !== 1) throw new Error('INVALID_AGENT_REGISTRY:schemaVersion');
  if (!Array.isArray(registry.agents) || registry.agents.length === 0) throw new Error('INVALID_AGENT_REGISTRY:agents');

  const ids = new Set();
  for (const agent of registry.agents) {
    const id = requireString(agent?.id, 'agent.id');
    requireString(agent?.name, `${id}.name`);
    requireString(agent?.description, `${id}.description`);
    if (ids.has(id)) throw new Error(`INVALID_AGENT_REGISTRY:duplicate:${id}`);
    if (agent.toolPolicy?.default !== 'deny') throw new Error(`INVALID_AGENT_REGISTRY:toolPolicy:${id}`);
    ids.add(id);
  }

  const defaultAgent = requireString(registry.defaultAgent, 'defaultAgent');
  if (!ids.has(defaultAgent)) throw new Error('INVALID_AGENT_REGISTRY:defaultAgent');
  return registry;
}

export function listPublicAgents(registry) {
  return registry.agents.map(({ id, name, kind, description }) => ({ id, name, kind, description }));
}

export function resolveAgent(registry, agentId) {
  const id = typeof agentId === 'string' && agentId.trim() ? agentId.trim() : registry.defaultAgent;
  return registry.agents.find((agent) => agent.id === id) || null;
}

export function createTraceId() {
  return randomUUID();
}

export function normalizeClientMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) return null;
  const normalized = [];
  for (const message of messages) {
    if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string') return null;
    if (message.content.length > 50000) return null;
    normalized.push({ role: message.role, content: message.content });
  }
  return normalized;
}

export function buildAgentSystemMessage(agent, traceId) {
  const lines = [
    `Sen ${agent.name} rolünde çalışan Hafize ajanısın.`,
    agent.description,
    '',
    'Görev:',
    ...(agent.mission || []).map((item) => `- ${item}`)
  ];

  if (Array.isArray(agent.guardrails) && agent.guardrails.length) {
    lines.push('', 'Sınırlar:', ...agent.guardrails.map((item) => `- ${item}`));
  }

  if (Array.isArray(agent.outputContract) && agent.outputContract.length) {
    lines.push('', `Beklenen çıktı alanları: ${agent.outputContract.join(', ')}`);
  }

  lines.push(
    '',
    'Araç yetkilerini kendin varsayma. Yalnızca backend tarafından açıkça sunulan araçları kullan; izin kararını backend verir.',
    `trace_id: ${traceId}`
  );

  return { role: 'system', content: lines.join('\n') };
}

export function authorizeAgentTool(agent, toolName, { approvalGranted = false } = {}) {
  const tool = typeof toolName === 'string' ? toolName.trim() : '';
  if (!tool) return { allowed: false, reason: 'invalid_tool' };

  const policy = agent?.toolPolicy || { default: 'deny' };
  if ((policy.deny || []).includes(tool)) return { allowed: false, reason: 'explicit_deny' };
  if ((policy.approvalRequired || []).includes(tool)) {
    return approvalGranted
      ? { allowed: true, reason: 'approved' }
      : { allowed: false, reason: 'approval_required' };
  }
  if ((policy.allow || []).includes(tool)) return { allowed: true, reason: 'allowlisted' };
  return { allowed: false, reason: 'default_deny' };
}
