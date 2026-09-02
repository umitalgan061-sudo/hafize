import { authorizeAgentTool } from './agent-runtime.mjs';
import { normalizeSkillManifest } from './skill-manifest.mjs';

const SOURCE_PRIORITY = Object.freeze({ builtin: 0, user: 1, project: 2 });
const MAX_SKILLS = 100;
const SCOPE_PATTERN = /^[a-z0-9][a-z0-9._/-]{0,120}$/i;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function normalizeScope(entry, { allowedProjectScopes }) {
  if (entry.source !== 'project') {
    if (entry.scope != null) fail('INVALID_SKILL_SCOPE');
    return null;
  }
  const scope = typeof entry.scope === 'string' ? entry.scope.trim() : '';
  if (!SCOPE_PATTERN.test(scope)) fail('INVALID_SKILL_SCOPE');
  if (!allowedProjectScopes.has(scope)) fail('SKILL_PROJECT_SCOPE_NOT_ALLOWED');
  return scope;
}

export function loadSkillRegistry(entries = [], { allowedProjectScopes = [] } = {}) {
  if (!Array.isArray(entries) || entries.length > MAX_SKILLS) fail('INVALID_SKILL_REGISTRY');
  if (!Array.isArray(allowedProjectScopes)) fail('INVALID_SKILL_REGISTRY');

  const scopes = new Set();
  for (const value of allowedProjectScopes) {
    const scope = typeof value === 'string' ? value.trim() : '';
    if (!SCOPE_PATTERN.test(scope)) fail('INVALID_SKILL_SCOPE');
    scopes.add(scope);
  }

  const bySource = new Map();
  const skills = new Map();
  for (const entry of entries) {
    if (!entry || Array.isArray(entry) || typeof entry !== 'object') fail('INVALID_SKILL_REGISTRY_ENTRY');
    for (const field of Object.keys(entry)) {
      if (!['source', 'scope', 'manifest'].includes(field)) fail('INVALID_SKILL_REGISTRY_ENTRY');
    }
    const scope = normalizeScope(entry, { allowedProjectScopes: scopes });
    const manifest = normalizeSkillManifest(entry.manifest, { source: entry.source });

    const sourceKey = `${manifest.source}:${manifest.id}`;
    if (bySource.has(sourceKey)) fail(`SKILL_ID_CONFLICT:${manifest.id}`);
    bySource.set(sourceKey, true);

    const skill = Object.freeze({ ...manifest, scope });
    const existing = skills.get(skill.id);
    if (!existing || SOURCE_PRIORITY[skill.source] > SOURCE_PRIORITY[existing.source]) {
      skills.set(skill.id, skill);
    }
  }

  return Object.freeze({ skills: Object.freeze(skills) });
}

export function listPublicSkills(registry) {
  return [...registry.skills.values()]
    .map(({ id, name, description, source, scope, execution, triggers }) => ({
      id,
      name,
      description,
      source,
      scope,
      execution,
      triggers: [...triggers]
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function findSkillsByTrigger(registry, text) {
  const haystack = typeof text === 'string' ? text.toLowerCase() : '';
  if (!haystack.trim()) return [];
  return [...registry.skills.values()]
    .filter((skill) => skill.triggers.some((trigger) => haystack.includes(trigger)))
    .map((skill) => skill.id)
    .sort();
}

export function resolveSkillForAgent(registry, skillId, agent, { approvalGranted = false } = {}) {
  const id = typeof skillId === 'string' ? skillId.trim() : '';
  const skill = registry?.skills?.get(id);
  if (!skill) return { ok: false, error: 'UNKNOWN_SKILL' };

  const allowedTools = [];
  const deniedTools = [];
  for (const permission of skill.allowedTools) {
    const authorization = authorizeAgentTool(agent, permission, { approvalGranted });
    if (authorization.allowed) allowedTools.push(permission);
    else deniedTools.push({ permission, reason: authorization.reason });
  }

  return {
    ok: true,
    value: Object.freeze({
      id: skill.id,
      source: skill.source,
      execution: skill.execution,
      model: skill.model,
      prompt: skill.prompt,
      arguments: skill.arguments,
      allowedTools: Object.freeze(allowedTools),
      deniedTools: Object.freeze(deniedTools)
    })
  };
}

export const SKILL_SOURCE_PRIORITY = SOURCE_PRIORITY;
export const SKILL_REGISTRY_LIMITS = Object.freeze({ maxSkills: MAX_SKILLS });
