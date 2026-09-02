import { authorizeAgentTool } from './agent-runtime.mjs';
import { SKILL_SOURCES, normalizeSkillManifest } from './skill-manifest.mjs';

// Öncelik: builtin > user > project. Güvenilir builtin skill adları
// kullanıcı veya proje kaynağı tarafından gölgelenemez.
const MAX_SKILLS = 200;
const PROJECT_PATH_PATTERN = /^[A-Za-z0-9._\/-]{1,200}$/;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function normalizeProjectPath(value, allowedPrefixes) {
  const path = typeof value === 'string' ? value.trim() : '';
  if (!PROJECT_PATH_PATTERN.test(path)) fail('INVALID_SKILL_PROJECT_PATH');
  if (path.startsWith('/') || path.split('/').includes('..')) fail('INVALID_SKILL_PROJECT_PATH');
  if (!allowedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) fail('SKILL_PROJECT_SCOPE_DENIED');
  return path;
}

function normalizeAllowedPrefixes(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 10) fail('INVALID_SKILL_PROJECT_SCOPE');
  return value.map((entry) => {
    const prefix = typeof entry === 'string' ? entry.trim().replace(/\/+$/, '') : '';
    const unsafe = prefix.startsWith('/') || prefix.split('/').includes('..');
    if (!PROJECT_PATH_PATTERN.test(prefix) || unsafe) fail('INVALID_SKILL_PROJECT_SCOPE');
    return prefix;
  });
}

function normalizeEntry(entry, source, allowedPrefixes) {
  const manifest = entry && typeof entry === 'object' && !Array.isArray(entry) && entry.manifest !== undefined
    ? entry.manifest
    : entry;
  const skill = normalizeSkillManifest(manifest, { source });
  if (source !== 'project') return skill;
  return Object.freeze({ ...skill, path: normalizeProjectPath(entry?.path, allowedPrefixes) });
}

export function createSkillRegistry({ builtin = [], user = [], project = [], projectScope = {} } = {}) {
  const projectAllowed = projectScope?.allowed === true;
  const allowedPrefixes = normalizeAllowedPrefixes(projectScope?.allowedPaths);
  if (projectAllowed && allowedPrefixes.length === 0) fail('INVALID_SKILL_PROJECT_SCOPE');

  const sources = { builtin, user, project };
  const skills = new Map();
  const shadowed = [];
  let total = 0;

  for (const source of SKILL_SOURCES) {
    const entries = sources[source];
    if (!Array.isArray(entries)) fail(`INVALID_SKILL_SOURCE_LIST:${source}`);
    if (source === 'project' && entries.length > 0 && !projectAllowed) fail('SKILL_PROJECT_SCOPE_DENIED');

    for (const entry of entries) {
      if (++total > MAX_SKILLS) fail('SKILL_REGISTRY_LIMIT');
      const skill = normalizeEntry(entry, source, allowedPrefixes);
      // Kaynaklar öncelik sırasıyla işlendiğinden ilk kayıt kazanır.
      const existing = skills.get(skill.name);
      if (existing) {
        shadowed.push(Object.freeze({ name: skill.name, source: skill.source, shadowedBy: existing.source }));
        continue;
      }
      skills.set(skill.name, skill);
    }
  }

  return Object.freeze({
    skills: Object.freeze([...skills.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'))),
    shadowed: Object.freeze(shadowed)
  });
}

export function listPublicSkills(registry) {
  return registry.skills.map(({ name, source, description, triggers, execution, arguments: args }) => (
    { name, source, description, triggers, execution, arguments: args }
  ));
}

export function resolveSkill(registry, skillName) {
  const name = typeof skillName === 'string' ? skillName.trim().toLowerCase() : '';
  if (!name) return null;
  return registry.skills.find((skill) => skill.name === name) || null;
}

export function matchSkillByTrigger(registry, text) {
  const haystack = typeof text === 'string' ? text.trim().toLowerCase() : '';
  if (!haystack) return null;
  for (const skill of registry.skills) {
    if (skill.triggers.some((trigger) => haystack.includes(trigger))) return skill;
  }
  return null;
}

export function authorizeSkillExecution(skill, agent, { approvalGranted = false } = {}) {
  if (!skill?.name || !Array.isArray(skill.tools)) return { ok: false, error: 'invalid_skill' };
  if (!agent?.id) return { ok: false, error: 'invalid_agent' };

  const denied = [];
  for (const tool of skill.tools) {
    const decision = authorizeAgentTool(agent, tool, { approvalGranted });
    if (!decision.allowed) denied.push({ tool, reason: decision.reason });
  }
  // Skill kendi yetkisini yükseltemez: ajan politikası bir aracı vermiyorsa
  // skill sessizce kısıtlanmaz, çalıştırma tamamen reddedilir.
  if (denied.length) return { ok: false, error: 'skill_tool_escalation', denied: Object.freeze(denied) };

  return Object.freeze({
    ok: true,
    name: skill.name,
    source: skill.source,
    execution: skill.execution,
    tools: Object.freeze([...skill.tools]),
    model: skill.model ?? null
  });
}

export const SKILL_SOURCE_PRECEDENCE = Object.freeze([...SKILL_SOURCES]);
export const SKILL_REGISTRY_LIMITS = Object.freeze({ maxSkills: MAX_SKILLS });
