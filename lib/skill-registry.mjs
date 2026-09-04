import { authorizeAgentTool } from './agent-runtime.mjs';
import { normalizeSkillManifest } from './skill-manifest.mjs';

const SOURCE_PRIORITY = new Map([
  ['builtin', 0],
  ['user', 1],
  ['project', 2]
]);
const MAX_SKILLS = 200;

function scopeAllowed(skill, allowedProjectScopes) {
  if (skill.source !== 'project') return true;
  return allowedProjectScopes.has(skill.projectScope);
}

export function buildSkillRegistry(manifests, { allowedProjectScopes = [] } = {}) {
  if (!Array.isArray(manifests) || manifests.length > MAX_SKILLS) {
    throw new Error('INVALID_SKILL_REGISTRY:manifests');
  }
  if (!Array.isArray(allowedProjectScopes)) throw new Error('INVALID_SKILL_REGISTRY:allowedProjectScopes');
  const scopes = new Set(allowedProjectScopes.filter((scope) => typeof scope === 'string' && scope.trim()).map((scope) => scope.trim()));

  const accepted = new Map();
  const rejected = [];

  for (const manifest of manifests) {
    let skill;
    try {
      skill = normalizeSkillManifest(manifest);
    } catch (error) {
      rejected.push({ id: typeof manifest?.id === 'string' ? manifest.id : null, reason: error?.reason || 'invalid_manifest' });
      continue;
    }

    if (!scopeAllowed(skill, scopes)) {
      rejected.push({ id: skill.id, reason: 'project_scope_not_allowed' });
      continue;
    }

    const existing = accepted.get(skill.id);
    if (!existing) {
      accepted.set(skill.id, skill);
      continue;
    }
    // Daha güvenilir kaynak kazanır: builtin > user > project. Project skill hiçbir zaman
    // builtin veya user skill'ini gölgeleyemez.
    if (SOURCE_PRIORITY.get(skill.source) < SOURCE_PRIORITY.get(existing.source)) {
      accepted.set(skill.id, skill);
      rejected.push({ id: existing.id, reason: 'shadowed_by_trusted_source' });
    } else {
      rejected.push({ id: skill.id, reason: 'shadowed_by_trusted_source' });
    }
  }

  return Object.freeze({
    skills: Object.freeze([...accepted.values()].sort((left, right) => left.id.localeCompare(right.id))),
    rejected: Object.freeze(rejected)
  });
}

export function listPublicSkills(registry) {
  return registry.skills.map(({ id, name, description, source, execution, triggers }) => ({
    id,
    name,
    description,
    source,
    execution,
    triggers: [...triggers]
  }));
}

export function resolveSkillForAgent(registry, skillId, agent, { approvalGranted = false } = {}) {
  const id = typeof skillId === 'string' ? skillId.trim() : '';
  const skill = id ? registry.skills.find((entry) => entry.id === id) : null;
  if (!skill) return { ok: false, error: 'SKILL_NOT_FOUND' };
  if (!agent) return { ok: false, error: 'SKILL_AGENT_REQUIRED' };

  // Fork execution yeni bir çalıştırma bağlamıdır; parent onayı otomatik miras alınmaz.
  const effectiveApproval = skill.execution === 'fork' ? false : approvalGranted === true;

  const grantedTools = [];
  const deniedTools = [];
  for (const tool of skill.allowedTools) {
    const decision = authorizeAgentTool(agent, tool, { approvalGranted: effectiveApproval });
    if (decision.allowed) grantedTools.push(tool);
    else deniedTools.push({ tool, reason: decision.reason });
  }

  return {
    ok: true,
    skill: Object.freeze({
      id: skill.id,
      name: skill.name,
      source: skill.source,
      execution: skill.execution,
      model: skill.model,
      prompt: skill.prompt,
      arguments: skill.arguments,
      grantedTools: Object.freeze(grantedTools),
      deniedTools: Object.freeze(deniedTools),
      approvalGranted: effectiveApproval
    })
  };
}
