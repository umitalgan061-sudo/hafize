import { authorizeAgentTool } from './agent-runtime.mjs';
import { normalizeSkillManifest } from './skill-manifest-contract.mjs';

const SOURCE_PRIORITY = new Map([
  ['builtin', 3],
  ['user', 2],
  ['project', 1]
]);
const SCOPE_PATTERN = /^[a-z0-9][a-z0-9._\/-]{0,119}$/i;
const MAX_SKILLS = 200;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function normalizeScopeList(value) {
  if (value == null) return new Set();
  if (!Array.isArray(value)) fail('INVALID_SKILL_PROJECT_SCOPES');
  const scopes = new Set();
  for (const item of value) {
    const scope = typeof item === 'string' ? item.trim() : '';
    if (!SCOPE_PATTERN.test(scope)) fail('INVALID_SKILL_PROJECT_SCOPES');
    scopes.add(scope);
  }
  return scopes;
}

export function createSkillRegistry({ allowedProjectScopes = [] } = {}) {
  const allowedScopes = normalizeScopeList(allowedProjectScopes);
  const skills = new Map();

  function register(manifestInput, { source, projectScope = null } = {}) {
    const skill = normalizeSkillManifest(manifestInput, { source });

    let scope = null;
    if (skill.source === 'project') {
      scope = typeof projectScope === 'string' ? projectScope.trim() : '';
      if (!SCOPE_PATTERN.test(scope)) fail('INVALID_SKILL_PROJECT_SCOPE');
      if (!allowedScopes.has(scope)) fail('SKILL_PROJECT_SCOPE_NOT_ALLOWED');
    } else if (projectScope != null) {
      fail('INVALID_SKILL_PROJECT_SCOPE');
    }

    const existing = skills.get(skill.name);
    if (existing) {
      const incomingPriority = SOURCE_PRIORITY.get(skill.source);
      const existingPriority = SOURCE_PRIORITY.get(existing.source);
      if (incomingPriority === existingPriority) fail('SKILL_REGISTRY_DUPLICATE');
      if (incomingPriority < existingPriority) fail('SKILL_REGISTRY_SHADOWED');
    }

    const entry = Object.freeze({ ...skill, projectScope: scope });
    skills.set(skill.name, entry);
    return entry;
  }

  function list() {
    return [...skills.values()]
      .map(({ name, source, description, triggers, execution }) => ({ name, source, description, triggers, execution }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function resolve(name) {
    const key = typeof name === 'string' ? name.trim().toLowerCase() : '';
    return skills.get(key) || null;
  }

  function resolveForAgent(agent, name, { approvalGranted = false } = {}) {
    const skill = resolve(name);
    if (!skill) fail('SKILL_NOT_FOUND');

    const tools = [];
    const deniedTools = [];
    for (const permission of skill.allowedTools) {
      const authorization = authorizeAgentTool(agent, permission, { approvalGranted });
      if (authorization.allowed) tools.push(permission);
      else deniedTools.push({ permission, reason: authorization.reason });
    }

    return Object.freeze({
      name: skill.name,
      source: skill.source,
      execution: skill.execution,
      model: skill.model,
      arguments: skill.arguments,
      prompt: skill.prompt,
      tools: Object.freeze(tools),
      deniedTools: Object.freeze(deniedTools)
    });
  }

  return Object.freeze({
    register(manifestInput, options) {
      if (skills.size >= MAX_SKILLS && !skills.has(manifestInput?.name)) fail('SKILL_REGISTRY_FULL');
      return register(manifestInput, options);
    },
    list,
    resolve,
    resolveForAgent,
    get size() {
      return skills.size;
    }
  });
}

export const SKILL_SOURCE_PRIORITY = Object.freeze(Object.fromEntries(SOURCE_PRIORITY));
