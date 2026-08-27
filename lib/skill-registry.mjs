import { authorizeAgentTool } from './agent-runtime.mjs';
import { normalizeSkillManifest, SKILL_SOURCES } from './skill-manifest.mjs';

const SOURCE_PRIORITY = new Map([['builtin', 0], ['user', 1], ['project', 2]]);
const MAX_SKILLS = 64;
const MAX_ARGUMENT_CHARS = 2000;
const MAX_MATCH_INPUT_CHARS = 4000;

function failed(error) {
  return { ok: false, error };
}

function normalizeArgumentValue(definition, value) {
  if (definition.type === 'string') {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    if (!normalized || normalized.length > MAX_ARGUMENT_CHARS) return null;
    return normalized;
  }
  if (definition.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return value;
  }
  if (typeof value !== 'boolean') return null;
  return value;
}

function prepareArguments(skill, args) {
  if (args === undefined) return { ok: true, values: Object.freeze({}) };
  if (!args || typeof args !== 'object' || Array.isArray(args)) return failed('SKILL_ARGUMENTS_INVALID');

  const values = {};
  for (const [key, value] of Object.entries(args)) {
    const definition = skill.arguments.find((argument) => argument.name === key);
    if (!definition) return failed('SKILL_ARGUMENT_UNKNOWN');
    const normalized = normalizeArgumentValue(definition, value);
    if (normalized === null) return failed('SKILL_ARGUMENT_INVALID');
    values[key] = normalized;
  }

  for (const definition of skill.arguments) {
    if (definition.required && values[definition.name] === undefined) return failed('SKILL_ARGUMENT_MISSING');
  }
  return { ok: true, values: Object.freeze(values) };
}

export function createSkillRegistry({ entries = [], projectScopeAllowed = false } = {}) {
  if (!Array.isArray(entries)) throw new Error('INVALID_SKILL_REGISTRY:entries');
  if (entries.length > MAX_SKILLS) throw new Error('INVALID_SKILL_REGISTRY:tooManySkills');

  const skills = new Map();
  const skipped = [];

  for (const entry of entries) {
    const source = typeof entry?.source === 'string' ? entry.source.trim() : '';
    if (!SKILL_SOURCES.includes(source)) {
      skipped.push({ id: '', source, reason: 'unknown_source' });
      continue;
    }
    if (source === 'project' && projectScopeAllowed !== true) {
      skipped.push({ id: typeof entry?.manifest?.id === 'string' ? entry.manifest.id : '', source, reason: 'project_scope_not_allowed' });
      continue;
    }

    const normalized = normalizeSkillManifest(entry?.manifest, { source });
    if (!normalized.ok) {
      skipped.push({ id: typeof entry?.manifest?.id === 'string' ? entry.manifest.id : '', source, reason: normalized.error });
      continue;
    }

    const skill = normalized.skill;
    const existing = skills.get(skill.id);
    if (existing) {
      const winner = SOURCE_PRIORITY.get(existing.source) <= SOURCE_PRIORITY.get(skill.source) ? existing : skill;
      const loser = winner === existing ? skill : existing;
      skills.set(skill.id, winner);
      skipped.push({ id: loser.id, source: loser.source, reason: 'shadowed_by_higher_precedence' });
      continue;
    }
    skills.set(skill.id, skill);
  }

  const ordered = Object.freeze(
    [...skills.values()].sort((left, right) => {
      const priority = SOURCE_PRIORITY.get(left.source) - SOURCE_PRIORITY.get(right.source);
      return priority !== 0 ? priority : left.id.localeCompare(right.id);
    })
  );
  const frozenSkipped = Object.freeze(skipped.map((item) => Object.freeze(item)));

  function list() {
    return ordered;
  }

  function get(id) {
    const key = typeof id === 'string' ? id.trim() : '';
    return skills.get(key) || null;
  }

  function match(input) {
    const haystack = (typeof input === 'string' ? input : '').slice(0, MAX_MATCH_INPUT_CHARS).toLowerCase();
    if (!haystack.trim()) return Object.freeze([]);
    return Object.freeze(ordered.filter((skill) => skill.triggers.some((trigger) => haystack.includes(trigger))));
  }

  function resolve(id, { agent, args } = {}) {
    const skill = get(id);
    if (!skill) return failed('SKILL_NOT_FOUND');
    if (!agent?.id) return failed('SKILL_AGENT_REQUIRED');

    for (const tool of skill.allowedTools) {
      if (!authorizeAgentTool(agent, tool).allowed) return failed('SKILL_TOOL_NOT_AUTHORIZED');
    }
    if (skill.execution === 'fork' && !authorizeAgentTool(agent, 'agent.delegate').allowed) {
      return failed('SKILL_FORK_NOT_AUTHORIZED');
    }

    const prepared = prepareArguments(skill, args);
    if (!prepared.ok) return prepared;

    return {
      ok: true,
      execution: Object.freeze({
        skillId: skill.id,
        name: skill.name,
        source: skill.source,
        mode: skill.execution,
        model: skill.model,
        tools: skill.allowedTools,
        prompt: skill.prompt,
        arguments: prepared.values,
        agentId: agent.id
      })
    };
  }

  return Object.freeze({ list, get, match, resolve, skipped: () => frozenSkipped });
}
