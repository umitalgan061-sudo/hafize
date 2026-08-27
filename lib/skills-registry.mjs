import { authorizeAgentTool } from './agent-runtime.mjs';
import { normalizeSkillManifest } from './skill-manifest.mjs';

const MAX_SKILLS_PER_SOURCE = 64;
const MAX_MATCH_TEXT_LENGTH = 2000;
const DEFAULT_MATCH_LIMIT = 5;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function normalizeSource(entries, source) {
  if (entries == null) return [];
  if (!Array.isArray(entries) || entries.length > MAX_SKILLS_PER_SOURCE) fail(`INVALID_SKILL_SOURCE_LIST:${source}`);

  const skills = [];
  const seen = new Set();
  for (const entry of entries) {
    const skill = normalizeSkillManifest(entry, { source });
    if (seen.has(skill.id)) fail(`SKILL_DUPLICATE_ID:${source}:${skill.id}`);
    seen.add(skill.id);
    skills.push(skill);
  }
  return skills;
}

function publicView(skill) {
  return Object.freeze({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    source: skill.source,
    execution: skill.execution,
    triggers: skill.triggers,
    overrides: skill.overrides || null
  });
}

export function createSkillRegistry({
  builtin = [],
  user = [],
  project = [],
  projectScopeAllowed = false
} = {}) {
  const projectEntries = Array.isArray(project) ? project : [];
  if (projectEntries.length && projectScopeAllowed !== true) fail('PROJECT_SKILL_SCOPE_DENIED');

  const skills = new Map();
  for (const skill of normalizeSource(builtin, 'builtin')) skills.set(skill.id, skill);

  for (const skill of normalizeSource(user, 'user')) {
    const shadowed = skills.get(skill.id);
    skills.set(skill.id, shadowed ? Object.freeze({ ...skill, overrides: 'builtin' }) : skill);
  }

  // Proje kaynağı repo içeriğidir; builtin veya kullanıcı skill'ini gölgeleyemez.
  for (const skill of normalizeSource(projectEntries, 'project')) {
    if (skills.has(skill.id)) fail(`SKILL_PROJECT_SHADOW:${skill.id}`);
    skills.set(skill.id, skill);
  }

  const ordered = Object.freeze([...skills.values()]);
  const publicList = Object.freeze(ordered.map(publicView));

  function resolve(skillId) {
    const id = typeof skillId === 'string' ? skillId.trim() : '';
    return (id && skills.get(id)) || null;
  }

  function match(text, { limit = DEFAULT_MATCH_LIMIT } = {}) {
    const haystack = typeof text === 'string' ? text.trim().toLowerCase().slice(0, MAX_MATCH_TEXT_LENGTH) : '';
    if (!haystack) return Object.freeze([]);

    const matched = [];
    for (const skill of ordered) {
      if (matched.length >= limit) break;
      if (skill.triggers.some((trigger) => haystack.includes(trigger))) matched.push(skill.id);
    }
    return Object.freeze(matched);
  }

  // Skill kendi araç yetkisini yükseltemez: izin daima ajan policy'sinden ve onaysız değerlendirilir.
  function authorizeSkill(agent, skillId) {
    const skill = resolve(skillId);
    if (!skill) return { ok: false, error: 'SKILL_NOT_FOUND' };

    for (const tool of skill.allowedTools) {
      const decision = authorizeAgentTool(agent, tool, { approvalGranted: false });
      if (!decision.allowed) return { ok: false, error: 'SKILL_TOOL_NOT_AUTHORIZED', tool, reason: decision.reason };
    }

    return {
      ok: true,
      skill,
      execution: skill.execution,
      tools: skill.allowedTools,
      inheritsParentTools: false
    };
  }

  return Object.freeze({ list: () => publicList, resolve, match, authorizeSkill });
}

export const SKILL_REGISTRY_LIMITS = Object.freeze({
  maxSkillsPerSource: MAX_SKILLS_PER_SOURCE,
  maxMatchTextLength: MAX_MATCH_TEXT_LENGTH,
  defaultMatchLimit: DEFAULT_MATCH_LIMIT
});
