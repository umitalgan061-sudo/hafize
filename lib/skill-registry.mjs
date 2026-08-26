import { authorizeAgentTool } from './agent-runtime.mjs';
import { SKILL_SOURCE_PRIORITY, normalizeSkillManifest } from './skill-manifest.mjs';

const MAX_SKILLS = 100;
const MAX_MATCH_TEXT_LENGTH = 4_000;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function normalizeAllowedProjects(value) {
  if (!Array.isArray(value)) fail('INVALID_SKILL_REGISTRY_PROJECTS');
  const projects = new Set();
  for (const item of value) {
    const project = typeof item === 'string' ? item.trim().toLowerCase() : '';
    if (!project) fail('INVALID_SKILL_REGISTRY_PROJECTS');
    projects.add(project);
  }
  return projects;
}

function publicView(skill) {
  return Object.freeze({
    name: skill.name,
    description: skill.description,
    triggers: skill.triggers,
    arguments: skill.arguments,
    execution: skill.execution,
    source: skill.source
  });
}

export function createSkillRegistry(manifests = [], { allowedProjects = [] } = {}) {
  if (!Array.isArray(manifests) || manifests.length > MAX_SKILLS) fail('INVALID_SKILL_REGISTRY');
  const projects = normalizeAllowedProjects(allowedProjects);

  const seenPerSource = new Set();
  const selected = new Map();
  const shadowed = [];

  for (const input of manifests) {
    const skill = normalizeSkillManifest(input);
    if (skill.source === 'project' && !projects.has(skill.project)) fail('SKILL_PROJECT_NOT_ALLOWED');

    const sourceKey = `${skill.source}:${skill.name}`;
    if (seenPerSource.has(sourceKey)) fail('DUPLICATE_SKILL_NAME');
    seenPerSource.add(sourceKey);

    const current = selected.get(skill.name);
    if (!current) {
      selected.set(skill.name, skill);
      continue;
    }
    const overrides = SKILL_SOURCE_PRIORITY[skill.source] > SKILL_SOURCE_PRIORITY[current.source];
    const loser = overrides ? current : skill;
    if (overrides) selected.set(skill.name, skill);
    shadowed.push(Object.freeze({
      name: loser.name,
      source: loser.source,
      shadowedBy: overrides ? skill.source : current.source
    }));
  }

  const skills = Object.freeze([...selected.values()].sort((a, b) => a.name.localeCompare(b.name)));
  const frozenShadowed = Object.freeze(shadowed);

  function get(name) {
    const key = typeof name === 'string' ? name.trim() : '';
    return skills.find((skill) => skill.name === key) || null;
  }

  function list() {
    return skills.map(publicView);
  }

  function match(text) {
    const haystack = typeof text === 'string' ? text.trim().toLowerCase().slice(0, MAX_MATCH_TEXT_LENGTH) : '';
    if (!haystack) return [];
    return skills.filter((skill) => skill.triggers.some((trigger) => haystack.includes(trigger))).map(publicView);
  }

  function authorize(name, agent) {
    const skill = get(name);
    if (!skill) return { ok: false, error: 'SKILL_NOT_FOUND' };
    if (!agent?.id) return { ok: false, error: 'SKILL_AGENT_REQUIRED' };

    for (const tool of skill.allowedTools) {
      if (!authorizeAgentTool(agent, tool).allowed) return { ok: false, error: 'SKILL_TOOL_NOT_AUTHORIZED' };
    }

    return {
      ok: true,
      skill: Object.freeze({
        name: skill.name,
        execution: skill.execution,
        model: skill.model,
        prompt: skill.prompt,
        tools: skill.allowedTools
      })
    };
  }

  return Object.freeze({ list, get, match, authorize, shadowed: frozenShadowed });
}

export const SKILL_REGISTRY_LIMITS = Object.freeze({
  maxSkills: MAX_SKILLS,
  maxMatchTextLength: MAX_MATCH_TEXT_LENGTH
});
