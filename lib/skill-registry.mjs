import { authorizeAgentTool } from './agent-runtime.mjs';
import { normalizeSkillManifest } from './skill-manifest.mjs';

const SOURCE_RANK = Object.freeze({ builtin: 0, user: 1, project: 2 });
const PROJECT_SCOPE_PATTERN = /^[a-z][a-z0-9._/-]{1,120}$/;
const MAX_SKILLS = 200;
const MAX_MATCH_TEXT = 20_000;

function failed(error, extra = {}) {
  return Object.freeze({ ok: false, error, ...extra });
}

// Prompt public görünüme girmez; model yalnız seçim için gereken alanları görür.
function publicView({ skill, source, projectScope }) {
  const { id, name, description, execution, triggers, allowedTools } = skill;
  return Object.freeze({ id, name, description, execution, source, projectScope, triggers, allowedTools });
}

function byTrust(a, b) {
  return SOURCE_RANK[a.source] - SOURCE_RANK[b.source] || a.skill.id.localeCompare(b.skill.id);
}

export function createSkillRegistry({ allowedProjectScopes = [] } = {}) {
  if (!Array.isArray(allowedProjectScopes)) throw new Error('INVALID_SKILL_REGISTRY:allowedProjectScopes');
  const projectScopes = new Set(allowedProjectScopes.map((item) => (typeof item === 'string' ? item.trim() : '')));
  for (const scope of projectScopes) {
    if (!PROJECT_SCOPE_PATTERN.test(scope)) throw new Error('INVALID_SKILL_REGISTRY:projectScope');
  }

  const entries = new Map();

  function register({ manifest, source, projectScope = null } = {}) {
    if (!Object.prototype.hasOwnProperty.call(SOURCE_RANK, source)) return failed('INVALID_SKILL_SOURCE');

    let scope = null;
    if (source === 'project') {
      scope = typeof projectScope === 'string' ? projectScope.trim() : '';
      if (!PROJECT_SCOPE_PATTERN.test(scope)) return failed('INVALID_SKILL_PROJECT_SCOPE');
      if (!projectScopes.has(scope)) return failed('PROJECT_SCOPE_NOT_ALLOWED');
    } else if (projectScope != null) {
      return failed('INVALID_SKILL_PROJECT_SCOPE');
    }

    let skill;
    try {
      skill = normalizeSkillManifest(manifest);
    } catch (error) {
      return failed(error.code || 'INVALID_SKILL_MANIFEST');
    }

    const existing = entries.get(skill.id);
    if (existing && SOURCE_RANK[existing.source] <= SOURCE_RANK[source]) {
      return failed('SKILL_ID_SHADOWED', { existingSource: existing.source });
    }
    if (!existing && entries.size >= MAX_SKILLS) return failed('SKILL_LIMIT_EXCEEDED');

    const entry = Object.freeze({ skill, source, projectScope: scope });
    entries.set(skill.id, entry);
    return Object.freeze({ ok: true, skill, source, replaced: Boolean(existing) });
  }

  function resolve(skillId) {
    const id = typeof skillId === 'string' ? skillId.trim() : '';
    const entry = id ? entries.get(id) : null;
    return entry ? entry.skill : null;
  }

  function list() {
    return Object.freeze([...entries.values()].sort(byTrust).map(publicView));
  }

  function match(text, { limit = 5 } = {}) {
    if (typeof text !== 'string' || !text.trim()) return Object.freeze([]);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) return Object.freeze([]);
    const haystack = text.slice(0, MAX_MATCH_TEXT).toLowerCase();
    const matches = [...entries.values()].filter((entry) => entry.skill.triggers.some((trigger) => haystack.includes(trigger)));
    return Object.freeze(matches.sort(byTrust).slice(0, limit).map(publicView));
  }

  return Object.freeze({ register, resolve, list, match, size: () => entries.size });
}

export function authorizeSkillTools(skill, agent) {
  if (!skill || !Array.isArray(skill.allowedTools)) return failed('INVALID_SKILL_MANIFEST');
  if (!agent?.id) return failed('INVALID_SKILL_AGENT');

  for (const tool of skill.allowedTools) {
    const decision = authorizeAgentTool(agent, tool);
    if (!decision.allowed) return failed('SKILL_TOOL_NOT_AUTHORIZED', { tool, reason: decision.reason });
  }
  return Object.freeze({ ok: true, tools: skill.allowedTools });
}

export const SKILL_REGISTRY_LIMITS = Object.freeze({ maxSkills: MAX_SKILLS, sourceRank: SOURCE_RANK });
