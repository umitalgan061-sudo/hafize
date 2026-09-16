export type AgentCapability = 'chat' | 'stream' | 'tools' | 'vision' | 'voice' | 'scheduling' | 'github' | 'google' | 'gmail' | 'canva';
export type AgentAvailability = 'online' | 'degraded' | 'offline' | 'unknown';
export interface AgentModel { readonly id: string; readonly label: string; readonly model?: string; readonly description?: string; readonly capabilities: readonly AgentCapability[]; readonly availability: AgentAvailability; readonly maxContextTokens?: number; readonly enabled: boolean; }
export interface AgentSelection { readonly agentId: string; readonly model: string; readonly capabilities: readonly AgentCapability[]; readonly selectedAt: string; }

const LIMITS = Object.freeze({ id: 120, label: 80, model: 160, description: 400, capabilities: 12, context: 2_000_000 });
const CAPABILITIES: readonly AgentCapability[] = Object.freeze(['chat', 'stream', 'tools', 'vision', 'voice', 'scheduling', 'github', 'google', 'gmail', 'canva']);
const clamp = (value: unknown, max: number): string => typeof value === 'string' ? value.trim().slice(0, max) : '';
export function isAgentCapability(value: unknown): value is AgentCapability { return typeof value === 'string' && CAPABILITIES.includes(value as AgentCapability); }
export function normalizeAgentAvailability(value: unknown): AgentAvailability { return value === 'online' || value === 'degraded' || value === 'offline' ? value : 'unknown'; }
export function normalizeAgent(value: unknown): AgentModel | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>; const id = clamp(item.id, LIMITS.id); const label = clamp(item.label, LIMITS.label); if (!id || !label) return null;
  const capabilities = Array.isArray(item.capabilities) ? [...new Set(item.capabilities.filter(isAgentCapability))].slice(0, LIMITS.capabilities) : ['chat'];
  const maxContextTokens = Number.isInteger(item.maxContextTokens) ? Math.min(LIMITS.context, Math.max(0, Number(item.maxContextTokens))) : undefined;
  return Object.freeze({ id, label, ...(clamp(item.model, LIMITS.model) ? { model: clamp(item.model, LIMITS.model) } : {}), ...(clamp(item.description, LIMITS.description) ? { description: clamp(item.description, LIMITS.description) } : {}), capabilities, availability: normalizeAgentAvailability(item.availability), ...(maxContextTokens ? { maxContextTokens } : {}), enabled: item.enabled !== false });
}
export function normalizeAgentList(value: unknown): AgentModel[] { if (!Array.isArray(value)) return []; const seen = new Set<string>(); const output: AgentModel[] = []; for (const raw of value) { const agent = normalizeAgent(raw); if (!agent || seen.has(agent.id) || !agent.enabled) continue; seen.add(agent.id); output.push(agent); } return output; }
export function selectAgent(agent: AgentModel, requestedModel?: string): AgentSelection { if (!agent.enabled) throw new Error('AGENT_DISABLED'); const model = clamp(requestedModel, LIMITS.model) || agent.model || agent.id; return Object.freeze({ agentId: agent.id, model, capabilities: Object.freeze([...agent.capabilities]), selectedAt: new Date().toISOString() }); }
export function supports(agent: AgentModel, capability: AgentCapability): boolean { return agent.enabled && agent.capabilities.includes(capability) && agent.availability !== 'offline'; }
export function compatibleAgents(agents: readonly AgentModel[], required: readonly AgentCapability[]): AgentModel[] { return agents.filter((agent) => required.every((capability) => supports(agent, capability))); }
export const HafizeAgentModel = Object.freeze({ isAgentCapability, normalizeAgentAvailability, normalizeAgent, normalizeAgentList, selectAgent, supports, compatibleAgents });
