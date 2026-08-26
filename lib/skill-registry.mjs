import { authorizeAgentTool } from './agent-runtime.mjs';
import { normalizeSkillManifest, SKILL_MANIFEST_CONTRACT } from './skill-manifest.mjs';

const MAX_SKILLS_PER_SOURCE = 50;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function grantedToolsFor(agent) {
  const allow = agent?.toolPolicy?.allow;
  return Array.isArray(allow) ? allow : [];
}

// Öncelik `builtin` > `user` > `project`: düşük öncelikli kaynak güvenilir bir skill'i
// gölgeleyemez, yalnız gözlemlenebilir `shadowed` listesine düşer.
export function buildSkillRegistry(sources = {}, { agent, agentIds = [], projectScopeAllowed = false } = {}) {
  if (!sources || Array.isArray(sources) || typeof sources !== 'object') fail('INVALID_SKILL_REGISTRY');
  for (const key of Object.keys(sources)) {
    if (!SKILL_MANIFEST_CONTRACT.sources.includes(key)) fail('INVALID_SKILL_SOURCE');
  }
  if (!agent?.id || agent?.toolPolicy?.default !== 'deny') fail('INVALID_SKILL_REGISTRY_AGENT');

  const grantedTools = grantedToolsFor(agent);
  const knownAgentIds = new Set(agentIds);
  const byName = new Map();
  const shadowed = [];

  for (const source of SKILL_MANIFEST_CONTRACT.sources) {
    const manifests = sources[source];
    if (manifests == null) continue;
    if (!Array.isArray(manifests) || manifests.length > MAX_SKILLS_PER_SOURCE) fail('INVALID_SKILL_REGISTRY');

    for (const manifest of manifests) {
      const skill = normalizeSkillManifest(manifest, { source, grantedTools, projectScopeAllowed });
      if (skill.executionContext === 'fork' && !knownAgentIds.has(skill.forkAgentId)) {
        fail('UNKNOWN_SKILL_FORK_AGENT');
      }
      if (byName.has(skill.name)) {
        shadowed.push(Object.freeze({ name: skill.name, source, shadowedBy: byName.get(skill.name).source }));
        continue;
      }
      byName.set(skill.name, skill);
    }
  }

  return Object.freeze({
    agentId: agent.id,
    skills: Object.freeze([...byName.values()]),
    shadowed: Object.freeze(shadowed)
  });
}

export function resolveSkill(registry, name) {
  const key = typeof name === 'string' ? name.trim() : '';
  if (!key) return null;
  return registry?.skills?.find((skill) => skill.name === key) || null;
}

export function listPublicSkills(registry) {
  return (registry?.skills || []).map(({ name, source, description, triggers, executionContext }) => ({
    name,
    source,
    description,
    triggers,
    executionContext
  }));
}

// Çalışma anı yetkisi skill bildirimi ile agent policy'sinin kesişimidir.
export function authorizeSkillTool(skill, agent, toolName, { approvalGranted = false } = {}) {
  const tool = typeof toolName === 'string' ? toolName.trim() : '';
  if (!tool) return { allowed: false, reason: 'invalid_tool' };
  if (!skill?.allowedTools?.includes(tool)) return { allowed: false, reason: 'not_declared_by_skill' };
  return authorizeAgentTool(agent, tool, { approvalGranted });
}

export const SKILL_REGISTRY_LIMITS = Object.freeze({ maxSkillsPerSource: MAX_SKILLS_PER_SOURCE });
