import { authorizeSkillTools, normalizeSkillManifest } from './skill-manifest.mjs';

const SOURCE_PRECEDENCE = Object.freeze(['builtin', 'user', 'project']);
const SCOPE_PATTERN = /^[a-z][a-z0-9._/-]{0,79}$/;
const MAX_SKILLS = 64;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function resolveScope(source, scope, allowedProjectScopes) {
  if (source !== 'project') {
    if (scope != null) fail('INVALID_SKILL_SOURCE:scope');
    return null;
  }
  const value = typeof scope === 'string' ? scope.trim() : '';
  if (!SCOPE_PATTERN.test(value)) fail('INVALID_SKILL_SOURCE:scope');
  if (!allowedProjectScopes.includes(value)) fail(`SKILL_PROJECT_SCOPE_NOT_ALLOWED:${value}`);
  return value;
}

export function createSkillRegistry(sources = [], { allowedProjectScopes = [] } = {}) {
  if (!Array.isArray(sources)) fail('INVALID_SKILL_SOURCE:sources');
  if (!Array.isArray(allowedProjectScopes)) fail('INVALID_SKILL_SOURCE:allowedProjectScopes');

  const allowedScopes = allowedProjectScopes.map((item) => (typeof item === 'string' ? item.trim() : ''));
  const entries = new Map();
  const shadowed = [];
  let total = 0;

  for (const rawSource of sources) {
    if (!rawSource || Array.isArray(rawSource) || typeof rawSource !== 'object') fail('INVALID_SKILL_SOURCE:entry');
    const source = typeof rawSource.source === 'string' ? rawSource.source.trim() : '';
    if (!SOURCE_PRECEDENCE.includes(source)) fail('INVALID_SKILL_SOURCE:source');
    if (!Array.isArray(rawSource.manifests)) fail('INVALID_SKILL_SOURCE:manifests');
    const scope = resolveScope(source, rawSource.scope, allowedScopes);

    const idsInSource = new Set();
    for (const manifest of rawSource.manifests) {
      if (++total > MAX_SKILLS) fail('SKILL_REGISTRY_LIMIT_EXCEEDED');
      const skill = normalizeSkillManifest(manifest);
      if (idsInSource.has(skill.id)) fail(`SKILL_REGISTRY_DUPLICATE:${skill.id}`);
      idsInSource.add(skill.id);

      const entry = Object.freeze({ skill, source, scope });
      const existing = entries.get(skill.id);
      if (!existing) {
        entries.set(skill.id, entry);
        continue;
      }
      const keepExisting = SOURCE_PRECEDENCE.indexOf(existing.source) <= SOURCE_PRECEDENCE.indexOf(source);
      const winner = keepExisting ? existing : entry;
      const loser = keepExisting ? entry : existing;
      entries.set(skill.id, winner);
      shadowed.push(Object.freeze({ id: skill.id, source: loser.source, shadowedBy: winner.source }));
    }
  }

  return Object.freeze({
    size: entries.size,
    shadowed: Object.freeze(shadowed),
    get(id) {
      const key = typeof id === 'string' ? id.trim() : '';
      return key ? entries.get(key) || null : null;
    },
    list() {
      return [...entries.values()];
    }
  });
}

export function listPublicSkills(registry) {
  return registry.list().map(({ skill, source }) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    triggers: [...skill.triggers],
    execution: skill.execution,
    source
  }));
}

export function resolveSkillInvocation(registry, skillId, { agent, approvalGranted = false } = {}) {
  const entry = registry?.get?.(skillId) || null;
  if (!entry) return { ok: false, error: 'SKILL_NOT_FOUND' };

  const authorization = authorizeSkillTools(entry.skill, agent, { approvalGranted });
  if (!authorization.ok) return { ok: false, error: authorization.error, reason: authorization.reason };

  const { skill } = entry;
  return {
    ok: true,
    invocation: Object.freeze({
      id: skill.id,
      source: entry.source,
      execution: skill.execution,
      model: skill.model,
      tools: authorization.tools,
      prompt: skill.prompt,
      arguments: skill.arguments
    })
  };
}

export const SKILL_SOURCE_PRECEDENCE = SOURCE_PRECEDENCE;
