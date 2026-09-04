import { authorizeAgentTool } from './agent-runtime.mjs';
import { SKILL_SOURCE_PRECEDENCE, normalizeSkillManifest } from './skill-manifest.mjs';

const MAX_SKILLS = 100;
const MAX_PROJECT_SCOPES = 32;

function rejectionName(entry) {
  const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
  return name && name.length <= 64 ? name : null;
}

function normalizeProjectScopes(value) {
  if (value == null) return new Set();
  if (!Array.isArray(value) || value.length > MAX_PROJECT_SCOPES) throw new Error('INVALID_SKILL_REGISTRY:allowedProjectScopes');
  const scopes = new Set();
  for (const item of value) {
    const scope = typeof item === 'string' ? item.trim() : '';
    if (!scope || scope.length > 120) throw new Error('INVALID_SKILL_REGISTRY:allowedProjectScopes');
    scopes.add(scope);
  }
  return scopes;
}

function normalizeSourceList(value, source) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(`INVALID_SKILL_REGISTRY:${source}`);
  return value;
}

export function createSkillRegistry({ builtin, user, project, allowedProjectScopes } = {}) {
  const projectScopes = normalizeProjectScopes(allowedProjectScopes);
  const bySource = {
    builtin: normalizeSourceList(builtin, 'builtin'),
    user: normalizeSourceList(user, 'user'),
    project: normalizeSourceList(project, 'project')
  };
  const skills = new Map();
  const rejected = [];
  const reject = (source, name, error) => rejected.push(Object.freeze({ source, name, error }));

  for (const source of SKILL_SOURCE_PRECEDENCE) {
    for (const entry of bySource[source]) {
      let skill;
      try {
        skill = normalizeSkillManifest(entry, { source });
      } catch (error) {
        reject(source, rejectionName(entry), error.code || 'INVALID_SKILL_MANIFEST');
        continue;
      }
      // Öncelik sırası: builtin > user > project. Düşük öncelikli kaynak var olan adı gölgeleyemez.
      if (skills.has(skill.name)) reject(source, skill.name, 'SKILL_NAME_SHADOWED');
      else if (source === 'project' && !projectScopes.has(skill.projectScope)) {
        reject(source, skill.name, 'SKILL_PROJECT_SCOPE_NOT_ALLOWED');
      } else if (skills.size >= MAX_SKILLS) reject(source, skill.name, 'SKILL_LIMIT_EXCEEDED');
      else skills.set(skill.name, skill);
    }
  }

  const frozenRejected = Object.freeze(rejected);
  return Object.freeze({
    size: skills.size,
    list() {
      return [...skills.values()].map(({ name, source, description, triggers, execution, model }) =>
        Object.freeze({ name, source, description, triggers, execution, model }));
    },
    resolve(name) {
      const key = typeof name === 'string' ? name.trim() : '';
      return key && skills.has(key) ? skills.get(key) : null;
    },
    rejected() { return frozenRejected; }
  });
}

export function resolveSkillExecution(registry, { name, agent } = {}) {
  if (typeof registry?.resolve !== 'function') throw new Error('INVALID_SKILL_REGISTRY:registry');
  if (!agent?.id) throw new Error('INVALID_SKILL_REGISTRY:agent');

  const skill = registry.resolve(name);
  if (!skill) return { ok: false, error: 'SKILL_NOT_FOUND' };
  if (skill.execution === 'fork' && !authorizeAgentTool(agent, 'agent.delegate').allowed) {
    return { ok: false, error: 'SKILL_FORK_NOT_AUTHORIZED' };
  }

  // Skill yetkisi ajan policy'siyle kesişimdir; onay gerektiren araç sessizce açılmaz.
  const tools = [];
  const approvalRequiredTools = [];
  const deniedTools = [];
  for (const tool of skill.allowedTools) {
    const decision = authorizeAgentTool(agent, tool);
    if (decision.allowed) tools.push(tool);
    else if (decision.reason === 'approval_required') approvalRequiredTools.push(tool);
    else deniedTools.push(tool);
  }

  return {
    ok: true,
    skill: Object.freeze({
      name: skill.name,
      source: skill.source,
      execution: skill.execution,
      model: skill.model,
      prompt: skill.prompt,
      arguments: skill.arguments,
      tools: Object.freeze(tools),
      approvalRequiredTools: Object.freeze(approvalRequiredTools),
      deniedTools: Object.freeze(deniedTools)
    })
  };
}

export const SKILL_REGISTRY_LIMITS = Object.freeze({ maxSkills: MAX_SKILLS, maxProjectScopes: MAX_PROJECT_SCOPES });
