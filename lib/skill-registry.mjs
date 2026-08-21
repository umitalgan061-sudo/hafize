import { authorizeAgentTool } from './agent-runtime.mjs';
import { normalizeSkillManifest } from './skill-manifest.mjs';

const SOURCE_PRIORITY = Object.freeze(['builtin', 'user', 'project']);
const SCOPE_PATTERN = /^[a-z0-9][a-z0-9._/-]{0,119}$/;
const MAX_SKILLS_PER_SOURCE = 64;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function requireList(value, source) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > MAX_SKILLS_PER_SOURCE) fail(`INVALID_SKILL_SOURCE_LIST:${source}`);
  return value;
}

function normalizeScopes(value) {
  if (value == null) return new Set();
  if (!Array.isArray(value) || value.length > MAX_SKILLS_PER_SOURCE) fail('INVALID_SKILL_PROJECT_SCOPES');
  const scopes = new Set();
  for (const item of value) {
    const scope = typeof item === 'string' ? item.trim() : '';
    if (!SCOPE_PATTERN.test(scope)) fail('INVALID_SKILL_PROJECT_SCOPES');
    scopes.add(scope);
  }
  return scopes;
}

function rejection(source, index, reason, name = null) {
  return Object.freeze({ source, index, reason, name });
}

/**
 * Kaynak öncelikli skill registry.
 *
 * - Öncelik `builtin > user > project`; düşük öncelikli kaynak yüksek öncelikli
 *   bir skill adını gölgeleyemez, yalnız `shadowed` olarak kayda geçer.
 * - `project` skill'i yalnız `allowedProjectScopes` içinde açıkça izin verilen
 *   kapsamdan yüklenir.
 * - Geçersiz manifest registry'yi bozmaz; hata kodu ile `rejected` listesine düşer.
 */
export function createSkillRegistry({ builtin, user, project, allowedProjectScopes } = {}) {
  const allowedScopes = normalizeScopes(allowedProjectScopes);
  const sources = { builtin: requireList(builtin, 'builtin'), user: requireList(user, 'user'), project: requireList(project, 'project') };

  const skills = new Map();
  const rejected = [];

  for (const source of SOURCE_PRIORITY) {
    const entries = sources[source];
    for (let index = 0; index < entries.length; index += 1) {
      let skill;
      try {
        skill = normalizeSkillManifest(entries[index], { source });
      } catch (error) {
        rejected.push(rejection(source, index, typeof error?.code === 'string' ? error.code : 'INVALID_SKILL_MANIFEST'));
        continue;
      }
      if (source === 'project' && !allowedScopes.has(skill.projectScope)) {
        rejected.push(rejection(source, index, 'PROJECT_SCOPE_NOT_ALLOWED', skill.name));
        continue;
      }
      const existing = skills.get(skill.name);
      if (existing) {
        const reason = existing.source === source ? 'DUPLICATE_SKILL_NAME' : 'SHADOWED_BY_HIGHER_PRIORITY_SOURCE';
        rejected.push(rejection(source, index, reason, skill.name));
        continue;
      }
      skills.set(skill.name, skill);
    }
  }

  const ordered = Object.freeze([...skills.values()]);
  const rejectedList = Object.freeze(rejected);

  function get(name) {
    const key = typeof name === 'string' ? name.trim() : '';
    return skills.get(key) || null;
  }

  function list() {
    return ordered;
  }

  function listRejected() {
    return rejectedList;
  }

  function matchTrigger(text) {
    const needle = typeof text === 'string' ? text.trim().toLowerCase() : '';
    if (!needle) return null;
    for (const skill of ordered) {
      if (skill.triggers.includes(needle)) return skill;
    }
    return null;
  }

  function listForAgent(agent, options = {}) {
    return Object.freeze(ordered.filter((skill) => authorizeSkill(agent, skill, options).allowed));
  }

  return Object.freeze({ get, list, listRejected, matchTrigger, listForAgent });
}

/**
 * Skill'in bir aracı kullanmasına izin verilip verilmediğini döndürür.
 *
 * `allowedTools` yalnız daraltıcıdır: agent policy'sinin vermediği bir izin
 * skill üzerinden kazanılamaz. Boş `allowedTools` daraltma yapmaz.
 */
export function authorizeSkillTool(agent, skill, permission, { approvalGranted = false } = {}) {
  const tool = typeof permission === 'string' ? permission.trim() : '';
  if (!tool) return { allowed: false, reason: 'invalid_tool' };
  if (!skill || typeof skill !== 'object' || !Array.isArray(skill.allowedTools)) {
    return { allowed: false, reason: 'invalid_skill' };
  }

  const agentDecision = authorizeAgentTool(agent, tool, { approvalGranted });
  if (!agentDecision.allowed) return agentDecision;
  if (skill.allowedTools.length && !skill.allowedTools.includes(tool)) {
    return { allowed: false, reason: 'skill_scope_denied' };
  }
  return agentDecision;
}

/**
 * Skill'in kendi bildirdiği araçların tamamı agent policy'si tarafından
 * karşılanıyorsa skill çalıştırılabilir kabul edilir.
 */
export function authorizeSkill(agent, skill, { approvalGranted = false } = {}) {
  if (!skill || typeof skill !== 'object' || !Array.isArray(skill.allowedTools)) {
    return { allowed: false, reason: 'invalid_skill' };
  }
  if (!agent || typeof agent !== 'object') return { allowed: false, reason: 'invalid_agent' };
  for (const permission of skill.allowedTools) {
    const decision = authorizeSkillTool(agent, skill, permission, { approvalGranted });
    if (!decision.allowed) return { allowed: false, reason: decision.reason };
  }
  return { allowed: true, reason: skill.allowedTools.length ? 'allowlisted' : 'no_tool_requirement' };
}

export const SKILL_SOURCE_PRIORITY = SOURCE_PRIORITY;
