// Expert agent federation: agent cards (capabilities, input/output schema, SLO, version, trust
// level, maintainer, quota), capability-based discovery, health checks against the SLO, per-agent
// daily quotas, output validation with one repair retry, and a delegation audit trail.
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { AgentDefinition, AgentRegistry } from './agent-runtime.ts';
import { percentile } from './telemetry.ts';
import { tokenize } from './memory-backend.ts';
import { parseModelJson } from './model-services.ts';

type Json = Record<string, unknown>;
export interface AgentCard {
  readonly agentId: string;
  readonly name: string;
  readonly description: string;
  readonly capabilities: readonly string[];
  readonly inputSchema: Json;
  readonly outputSchema: Json;
  readonly slo: { readonly latencyP99Ms: number; readonly availability: number };
  readonly version: string;
  readonly trustLevel: 'core' | 'verified' | 'community';
  readonly maintainer: string;
  readonly quota: { readonly callsPerDay: number; readonly tokensPerDay: number };
}

const DEFAULT_CARD = Object.freeze({
  inputSchema: { type: 'object', properties: { task: { type: 'string' } }, required: ['task'] },
  outputSchema: { type: 'string' },
  slo: { latencyP99Ms: 90_000, availability: 0.95 },
  version: '1.0.0',
  trustLevel: 'community' as const,
  maintainer: 'unknown',
  quota: { callsPerDay: 100, tokensPerDay: 200_000 }
});

/** Minimal JSON Schema check (type, properties, required, items, enum, string length). Returns error paths. */
export function validateJsonSchema(value: unknown, schema: Json, path = '$'): string[] {
  const type = String(schema.type || '');
  const errors: string[] = [];
  const is = (expected: string) => {
    if (expected === 'array') return Array.isArray(value);
    if (expected === 'object') return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    if (expected === 'integer') return Number.isInteger(value);
    if (expected === 'null') return value === null;
    return typeof value === expected;
  };
  if (type && !is(type)) return [`${path}: ${type} bekleniyordu`];
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) errors.push(`${path}: izin verilmeyen değer`);
  if (type === 'string') {
    if (Number.isInteger(schema.minLength) && String(value).length < Number(schema.minLength)) errors.push(`${path}: çok kısa`);
    if (Number.isInteger(schema.maxLength) && String(value).length > Number(schema.maxLength)) errors.push(`${path}: çok uzun`);
  }
  if (type === 'object') {
    const object = value as Json;
    for (const key of Array.isArray(schema.required) ? schema.required as string[] : []) if (!(key in object)) errors.push(`${path}.${key}: zorunlu`);
    const properties = (schema.properties && typeof schema.properties === 'object' ? schema.properties : {}) as Record<string, Json>;
    for (const [key, sub] of Object.entries(properties)) if (key in object) errors.push(...validateJsonSchema(object[key], sub, `${path}.${key}`));
  }
  if (type === 'array' && schema.items && typeof schema.items === 'object') (value as unknown[]).forEach((item, index) => errors.push(...validateJsonSchema(item, schema.items as Json, `${path}[${index}]`)));
  return errors.slice(0, 20);
}

export function cardFor(agent: AgentDefinition): AgentCard {
  const raw = ((agent as unknown as { card?: Json }).card || {}) as Json;
  const trust = ['core', 'verified', 'community'].includes(String(raw.trustLevel)) ? raw.trustLevel as AgentCard['trustLevel'] : DEFAULT_CARD.trustLevel;
  const slo = (raw.slo || {}) as Json;
  const quota = (raw.quota || {}) as Json;
  return Object.freeze({
    agentId: agent.id,
    name: agent.name,
    description: agent.description,
    capabilities: Object.freeze(Array.isArray(raw.capabilities) ? raw.capabilities.map(String).slice(0, 30) : []),
    inputSchema: raw.inputSchema && typeof raw.inputSchema === 'object' ? raw.inputSchema as Json : DEFAULT_CARD.inputSchema,
    outputSchema: raw.outputSchema && typeof raw.outputSchema === 'object' ? raw.outputSchema as Json : DEFAULT_CARD.outputSchema,
    slo: { latencyP99Ms: Number(slo.latencyP99Ms) > 0 ? Number(slo.latencyP99Ms) : DEFAULT_CARD.slo.latencyP99Ms, availability: Number(slo.availability) > 0 ? Number(slo.availability) : DEFAULT_CARD.slo.availability },
    version: typeof raw.version === 'string' ? raw.version : DEFAULT_CARD.version,
    trustLevel: trust,
    maintainer: typeof raw.maintainer === 'string' ? raw.maintainer : DEFAULT_CARD.maintainer,
    quota: { callsPerDay: Number(quota.callsPerDay) > 0 ? Number(quota.callsPerDay) : DEFAULT_CARD.quota.callsPerDay, tokensPerDay: Number(quota.tokensPerDay) > 0 ? Number(quota.tokensPerDay) : DEFAULT_CARD.quota.tokensPerDay }
  });
}

const hash = (value: unknown) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value ?? null)).digest('hex').slice(0, 32);

export function createExpertRegistry({ registry, db, now = () => Date.now(), isToolAvailable = () => true }: {
  readonly registry: AgentRegistry; readonly db: DatabaseSync; readonly now?: () => number;
  /** Whether the runtime can actually execute a permission right now (connector configured etc.). */
  readonly isToolAvailable?: (permission: string) => boolean;
}) {
  const specialists = () => registry.agents.filter((agent) => agent.kind === 'specialist');
  const day = () => new Date(now()).toISOString().slice(0, 10);

  function cards(): AgentCard[] {
    return specialists().map(cardFor);
  }

  /** Ranks specialists for a capability query: capability/description term overlap, trust and health. */
  function resolve(query: string, { limit = 3 }: { readonly limit?: number } = {}) {
    const terms = new Set(tokenize(query));
    const trustBonus = { core: 0.15, verified: 0.1, community: 0 } as const;
    return cards().map((card) => {
      const capabilityTokens = tokenize(card.capabilities.join(' '));
      const descriptionTokens = tokenize(`${card.name} ${card.description}`);
      const capabilityHits = capabilityTokens.filter((token) => terms.has(token)).length;
      const descriptionHits = descriptionTokens.filter((token) => terms.has(token)).length;
      const health = healthCheck(card.agentId);
      const score = (capabilityHits * 1 + descriptionHits * 0.4) / Math.max(1, terms.size) + trustBonus[card.trustLevel] - (health.healthy ? 0 : 0.5);
      return { agentId: card.agentId, name: card.name, description: card.description, capabilities: card.capabilities, trustLevel: card.trustLevel, version: card.version, healthy: health.healthy, score: Math.round(score * 1000) / 1000 };
    }).filter((item) => item.score > 0.15).sort((a, b) => b.score - a.score).slice(0, Math.min(Math.max(limit, 1), 10));
  }

  /** Health against the card's SLO, from the last 50 delegations plus tool availability. */
  function healthCheck(agentId: string) {
    const agent = registry.agents.find((item) => item.id === agentId);
    if (!agent) return { agentId, healthy: false, reasons: ['bilinmeyen ajan'], successRate: null, p99Ms: null };
    const card = cardFor(agent);
    const rows = db.prepare('SELECT latency_ms AS latency, ok FROM delegations WHERE child_agent_id = ? ORDER BY id DESC LIMIT 50').all(agentId) as Array<{ latency: number; ok: number }>;
    const reasons: string[] = [];
    const missing = (agent.toolPolicy.allow || []).filter((permission) => !['trace.write', 'agent.read_result', 'task.read', 'task.update_ledger', 'skill.invoke'].includes(permission) && !isToolAvailable(permission));
    if (missing.length === (agent.toolPolicy.allow || []).filter((permission) => permission !== 'trace.write').length && missing.length) reasons.push(`araçlar kullanılamıyor: ${missing.join(', ')}`);
    const successRate = rows.length ? rows.filter((row) => row.ok).length / rows.length : null;
    const p99Ms = rows.length ? percentile(rows.map((row) => Number(row.latency)).sort((a, b) => a - b), 99) : null;
    if (successRate !== null && rows.length >= 5 && successRate < card.slo.availability) reasons.push(`başarı oranı ${Math.round(successRate * 100)}% < SLO ${Math.round(card.slo.availability * 100)}%`);
    if (p99Ms !== null && rows.length >= 5 && p99Ms > card.slo.latencyP99Ms) reasons.push(`p99 gecikme ${p99Ms} ms > SLO ${card.slo.latencyP99Ms} ms`);
    const quota = quotaStatus(agentId);
    if (quota.exhausted) reasons.push('günlük kota doldu');
    return { agentId, healthy: !reasons.length, reasons, successRate, p99Ms, quota };
  }

  function quotaStatus(agentId: string) {
    const agent = registry.agents.find((item) => item.id === agentId);
    const card = agent ? cardFor(agent) : null;
    const row = db.prepare('SELECT calls, tokens FROM agent_quota WHERE agent_id = ? AND day = ?').get(agentId, day()) as { calls: number; tokens: number } | undefined;
    const calls = Number(row?.calls || 0);
    const tokens = Number(row?.tokens || 0);
    return { calls, tokens, callsPerDay: card?.quota.callsPerDay ?? 0, tokensPerDay: card?.quota.tokensPerDay ?? 0, exhausted: Boolean(card) && (calls >= card!.quota.callsPerDay || tokens >= card!.quota.tokensPerDay) };
  }

  /** Reserves one call against today's quota; false when the agent is out of quota. */
  function consumeCall(agentId: string): boolean {
    if (quotaStatus(agentId).exhausted) return false;
    db.prepare('INSERT INTO agent_quota (agent_id, day, calls, tokens) VALUES (?, ?, 1, 0) ON CONFLICT(agent_id, day) DO UPDATE SET calls = calls + 1').run(agentId, day());
    return true;
  }
  function addTokens(agentId: string, tokens: number): void {
    if (!Number.isFinite(tokens) || tokens <= 0) return;
    db.prepare('INSERT INTO agent_quota (agent_id, day, calls, tokens) VALUES (?, ?, 0, ?) ON CONFLICT(agent_id, day) DO UPDATE SET tokens = tokens + excluded.tokens').run(agentId, day(), Math.round(tokens));
  }

  /** Checks a delegated result against the agent's output schema. String schemas accept any text. */
  function validateOutput(agentId: string, content: string): { ok: true; value: unknown } | { ok: false; errors: string[] } {
    const agent = registry.agents.find((item) => item.id === agentId);
    const schema = agent ? cardFor(agent).outputSchema : DEFAULT_CARD.outputSchema;
    if (schema.type === 'string' || !schema.type) return content.trim() ? { ok: true, value: content } : { ok: false, errors: ['$: boş yanıt'] };
    let parsed: unknown;
    try { parsed = parseModelJson(content); } catch { return { ok: false, errors: ['$: JSON bekleniyordu'] }; }
    const errors = validateJsonSchema(parsed, schema);
    return errors.length ? { ok: false, errors } : { ok: true, value: parsed };
  }

  function audit({ parentTraceId, childAgentId, task, result, latencyMs, tokens = 0, ok }: { readonly parentTraceId: string; readonly childAgentId: string; readonly task: unknown; readonly result: unknown; readonly latencyMs: number; readonly tokens?: number; readonly ok: boolean }): void {
    db.prepare('INSERT INTO delegations (parent_trace_id, child_agent_id, task_hash, result_hash, latency_ms, tokens, ok, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(parentTraceId, childAgentId, hash(task), hash(result), Math.max(0, Math.round(latencyMs)), Math.max(0, Math.round(tokens)), ok ? 1 : 0, now());
  }

  function delegationLog(limit = 50) {
    return db.prepare('SELECT parent_trace_id AS parentTraceId, child_agent_id AS childAgentId, task_hash AS taskHash, result_hash AS resultHash, latency_ms AS latencyMs, tokens, ok, created_at AS createdAt FROM delegations ORDER BY id DESC LIMIT ?').all(Math.min(Math.max(limit, 1), 500));
  }

  /** Short catalogue for the primary agent's system prompt. */
  function promptCatalog(): string {
    return cards().map((card) => `- ${card.agentId} (${card.name}): ${card.capabilities.slice(0, 8).join(', ')}`).join('\n');
  }

  return Object.freeze({ cards, resolve, healthCheck, quotaStatus, consumeCall, addTokens, validateOutput, audit, delegationLog, promptCatalog });
}
export type ExpertRegistry = ReturnType<typeof createExpertRegistry>;
