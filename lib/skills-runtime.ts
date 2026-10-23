// TypeScript migration wave 2026-10.
// Compatibility-preserving typed runtime path.
// @ts-nocheck
import { readFile } from 'node:fs/promises';
import { readFileSync as readTextFileSync } from 'node:fs';
import { createSkillsRegistry } from './skills-registry.ts';
import { createSkillSelector } from './skill-selector.ts';
import { randomUUID } from 'node:crypto';
import { createFileSkillAuditSink, createSkillAuditLog, hashSkillAuditValue } from './skill-audit.ts';
import { createSkillConsentRuntime } from './skill-consent-runtime.ts';
import { createIdempotencyStore, hashInvocation } from './skill-idempotency.ts';

const DEFAULT_BUILTIN_URL = new URL('../skills/builtin.json', import.meta.url);
const MAX_SKILLS = 64;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function normalizeProjectList(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail('INVALID_SKILL_PROJECT_SCOPE');
  return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
}

function readBuiltinManifests(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SKILLS) fail('INVALID_BUILTIN_SKILLS');
  return value;
}

function buildRuntime(raw, allowedProjects, createRegistry = createSkillsRegistry, auditLog = createSkillAuditLog(), consentRuntime = createSkillConsentRuntime(), idempotencyStore = createIdempotencyStore()) {
  const registry = createRegistry({ allowedProjects: normalizeProjectList(allowedProjects) });
  for (const manifest of readBuiltinManifests(raw)) registry.register(manifest, { source: 'builtin' });

  // The runtime layer resolves a skill against the tools the agent already has:
  // declared tools the policy denies are dropped instead of hiding the skill.
  function listForAgent(agent) {
    return registry.listForAgent(agent, { intersectTools: true });
  }

  function selectForAgent(agent, query, options) {
    if (!agent || typeof agent !== 'object') fail('INVALID_SKILL_AGENT');
    return createSkillSelector(listForAgent(agent)).select(query, options);
  }

  function rankForAgent(agent, query) {
    if (!agent || typeof agent !== 'object') fail('INVALID_SKILL_AGENT');
    return createSkillSelector(listForAgent(agent)).rank(query);
  }

  function resolveForAgent({ agent, skillId, args = {}, approvalGranted = false, traceId = randomUUID(), ownerId, sessionId, idemKey } = {}) {
    const id = typeof skillId === 'string' ? skillId.trim() : '';
    if (!id) return null;
    const idemKeyEffective = typeof idemKey === 'string' && idemKey.trim() ? idemKey.trim() : hashInvocation(id, args, agent?.id, sessionId);
    if (idempotencyStore?.has(idemKeyEffective)) {
      const cached = idempotencyStore.get(idemKeyEffective);
      auditLog.record({ stage: 'resolved', traceId, agentId: agent?.id, skillId: id, arguments: args, result: { idempotent: true } });
      return cached;
    }
    try {
      const registered = registry.get(id);
      if (!registered) fail('UNKNOWN_SKILL');
      const manifest = registered.manifest;
      const consentRequired = manifest.riskLevel !== 'low' || manifest.sideEffects.mutates;
      const scopes = manifest.requiredScopes.length ? manifest.requiredScopes : manifest.allowedTools;
      const invocation = Object.freeze(registry.resolveInvocation({
        agent,
        name: id,
        args,
        approvalGranted: approvalGranted === true,
        // Resolution only prepares a prompt and permission set. The actual tool
        // calls remain independently checked by the tool executor.
        consentGranted: consentRequired,
        approvedScopes: consentRequired ? scopes : [],
        intersectTools: true
      }));
      const consent = consentRequired
        ? consentRuntime.authorize({ ownerId, sessionId, skillId: id, scopes, argsHash: hashSkillAuditValue(invocation.arguments) })
        : { allowed: true, reason: 'not_required', consentId: '' };
      if (!consent.allowed) {
        const code = consent.reason === 'consent_denied' ? 'SKILL_CONSENT_DENIED' : 'SKILL_CONSENT_REQUIRED';
        const error = new Error(code);
        error.code = code;
        error.consent = Object.freeze({
          skillId: id,
          description: manifest.description,
          scopes,
          riskLevel: manifest.riskLevel,
          sideEffects: manifest.sideEffects,
          argsHash: hashSkillAuditValue(invocation.arguments),
          arguments: invocation.arguments
        });
        throw error;
      }
      auditLog.record({
        stage: 'resolved', traceId, agentId: agent?.id, skillId: invocation.name,
        arguments: invocation.arguments, consentId: consent.consentId,
        result: { tools: invocation.tools, riskLevel: invocation.riskLevel, sideEffects: invocation.sideEffects }
      });
      const result = Object.freeze({ ...invocation, consentId: consent.consentId || '', idemKey: idemKeyEffective });
      if (idempotencyStore) idempotencyStore.set(idemKeyEffective, result);
      return result;
    } catch (error) {
      auditLog.record({ stage: 'denied', traceId, agentId: agent?.id, skillId: id, arguments: args, result: { error: error?.code || error?.message || 'SKILL_RESOLUTION_FAILED' } });
      throw error;
    }
  }

  function describePublic(agent) {
    return Object.freeze(listForAgent(agent).map(({ name, description, triggers, arguments: args, execution, source, requiresApproval, parameters, returns, requiredScopes, sideEffects, riskLevel, rollbackHint }) => Object.freeze({
      name, description, triggers, arguments: args, parameters, returns, requiredScopes, sideEffects, riskLevel, rollbackHint, execution, source, requiresApproval
    })));
  }

  return Object.freeze({ registry, listForAgent, selectForAgent, rankForAgent, resolveForAgent, describePublic, auditLog, consentRuntime, size: registry.size });
}

export async function createSkillsRuntime({
  fileUrl = DEFAULT_BUILTIN_URL,
  allowedProjects = [],
  readFileImpl = readFile,
  createRegistry = createSkillsRegistry,
  auditLog = createSkillAuditLog({ sink: createFileSkillAuditSink() }),
  consentRuntime = createSkillConsentRuntime(),
  idempotencyStore
} = {}) {
  if (typeof readFileImpl !== 'function') fail('INVALID_SKILL_RUNTIME_READER');
  if (typeof createRegistry !== 'function') fail('INVALID_SKILL_RUNTIME_REGISTRY');

  let raw;
  try {
    raw = JSON.parse(await readFileImpl(fileUrl, 'utf8'));
  } catch {
    fail('SKILL_CATALOG_UNREADABLE');
  }
  return buildRuntime(raw, allowedProjects, createRegistry, auditLog, consentRuntime, idempotencyStore);
}

export function createBuiltinSkillsRuntimeSync({
  fileUrl = DEFAULT_BUILTIN_URL,
  allowedProjects = [],
  readFileImpl = readTextFileSync,
  createRegistry = createSkillsRegistry,
  auditLog = createSkillAuditLog({ sink: createFileSkillAuditSink() }),
  consentRuntime = createSkillConsentRuntime(),
  idempotencyStore
} = {}) {
  if (typeof readFileImpl !== 'function') fail('INVALID_SKILL_RUNTIME_READER');
  if (typeof createRegistry !== 'function') fail('INVALID_SKILL_RUNTIME_REGISTRY');
  let raw;
  try {
    raw = JSON.parse(readFileImpl(fileUrl, 'utf8'));
  } catch {
    fail('SKILL_CATALOG_UNREADABLE');
  }
  return buildRuntime(raw, allowedProjects, createRegistry, auditLog, consentRuntime, idempotencyStore);
}

export const SKILLS_RUNTIME_DEFAULTS = Object.freeze({
  maxSkills: MAX_SKILLS,
  builtinSource: 'builtin',
  defaultExecution: 'inline'
});
