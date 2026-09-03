import { authorizeAgentTool } from './agent-runtime.mjs';
import { normalizeSkillManifest } from './skills-manifest.mjs';

// Lower rank wins a duplicate id: a project manifest can never shadow a
// builtin or user skill by reusing its name.
const SOURCE_RANK = { builtin: 0, user: 1, project: 2 };
const MAX_SKILLS = 100;
const MAX_PROJECT_SCOPES = 20;

function fail(error) {
  return { ok: false, error };
}

function normalizeProjectScopes(value) {
  if (value == null) return new Set();
  if (!Array.isArray(value) || value.length > MAX_PROJECT_SCOPES) {
    throw new Error('INVALID_SKILL_REGISTRY:allowedProjectScopes');
  }
  const scopes = new Set();
  for (const item of value) {
    const scope = typeof item === 'string' ? item.trim() : '';
    if (!scope || scope.length > 120) throw new Error('INVALID_SKILL_REGISTRY:allowedProjectScopes.scope');
    scopes.add(scope);
  }
  return scopes;
}

export function loadSkillRegistry({ manifests, allowedProjectScopes } = {}) {
  try {
    if (!Array.isArray(manifests) || manifests.length > MAX_SKILLS) {
      throw new Error('INVALID_SKILL_REGISTRY:manifests');
    }
    const scopes = normalizeProjectScopes(allowedProjectScopes);

    const bySkillId = new Map();
    const shadowed = [];
    for (const manifest of manifests) {
      const normalized = normalizeSkillManifest(manifest);
      if (!normalized.ok) throw new Error(normalized.error);

      const skill = normalized.skill;
      if (skill.source === 'project' && !scopes.has(skill.projectScope)) {
        throw new Error('SKILL_PROJECT_SCOPE_NOT_ALLOWED');
      }

      const existing = bySkillId.get(skill.id);
      if (!existing) {
        bySkillId.set(skill.id, skill);
        continue;
      }
      if (existing.source === skill.source) {
        throw new Error(`INVALID_SKILL_REGISTRY:duplicate:${skill.id}`);
      }
      const winner = SOURCE_RANK[existing.source] <= SOURCE_RANK[skill.source] ? existing : skill;
      const loser = winner === existing ? skill : existing;
      bySkillId.set(skill.id, winner);
      shadowed.push({ id: loser.id, source: loser.source });
    }

    return {
      ok: true,
      registry: Object.freeze({
        skills: Object.freeze([...bySkillId.values()].map((skill) => Object.freeze(skill))),
        shadowed: Object.freeze(shadowed.map((entry) => Object.freeze(entry)))
      })
    };
  } catch (error) {
    return fail(error.message);
  }
}

export function listPublicSkills(registry) {
  return (registry?.skills || []).map(({ id, name, description, source, execution, triggers }) => ({
    id,
    name,
    description,
    source,
    execution,
    triggers
  }));
}

export function resolveSkill(registry, skillId) {
  const id = typeof skillId === 'string' ? skillId.trim() : '';
  if (!id) return null;
  return (registry?.skills || []).find((skill) => skill.id === id) || null;
}

/**
 * A skill never widens the invoking agent's tool authority: every tool the
 * manifest asks for must already be reachable for that agent, and tools the
 * agent gates behind approval stay gated when a skill runs.
 */
export function authorizeSkillTools(agent, skill) {
  if (!agent?.id) return fail('INVALID_SKILL_AUTHORIZATION:agent');
  if (!skill?.id || !Array.isArray(skill.allowedTools)) {
    return fail('INVALID_SKILL_AUTHORIZATION:skill');
  }

  const allowed = [];
  const approvalRequired = [];
  for (const tool of skill.allowedTools) {
    const decision = authorizeAgentTool(agent, tool);
    if (decision.allowed) {
      allowed.push(tool);
      continue;
    }
    if (decision.reason === 'approval_required') {
      approvalRequired.push(tool);
      continue;
    }
    return fail(`SKILL_TOOL_ESCALATION:${tool}`);
  }

  return { ok: true, tools: { allowed, approvalRequired } };
}

export const SKILL_SOURCE_PRECEDENCE = Object.freeze(['builtin', 'user', 'project']);
