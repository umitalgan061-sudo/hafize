import { readFile } from 'node:fs/promises';
import { createSkillsRegistry } from './skills-registry.mjs';
import { createSkillSelector } from './skill-selector.mjs';

const DEFAULT_BUILTIN_URL = new URL('../skills/builtin.json', import.meta.url);
const MAX_SKILLS = 64;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function normalizeProjectList(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail('INVALID_SKILL_PROJECT_SCOPE');
  return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
}

function readBuiltinManifests(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SKILLS) fail('INVALID_BUILTIN_SKILLS');
  return value;
}

export async function createSkillsRuntime({
  fileUrl = DEFAULT_BUILTIN_URL,
  allowedProjects = [],
  readFileImpl = readFile,
  createRegistry = createSkillsRegistry
} = {}) {
  if (typeof readFileImpl !== 'function') fail('INVALID_SKILL_RUNTIME_READER');
  if (typeof createRegistry !== 'function') fail('INVALID_SKILL_RUNTIME_REGISTRY');

  let raw;
  try {
    raw = JSON.parse(await readFileImpl(fileUrl, 'utf8'));
  } catch {
    fail('SKILL_CATALOG_UNREADABLE');
  }

  const registry = createRegistry({ allowedProjects: normalizeProjectList(allowedProjects) });
  for (const manifest of readBuiltinManifests(raw)) registry.register(manifest, { source: 'builtin' });

  function listForAgent(agent) {
    return registry.listForAgent(agent);
  }

  function resolveForAgent({ agent, skillId, args = {}, approvalGranted = false } = {}) {
    const id = typeof skillId === 'string' ? skillId.trim() : '';
    if (!id) return null;
    return Object.freeze(registry.resolveInvocation({ agent, name: id, args, approvalGranted: approvalGranted === true }));
  }

  function describePublic(agent) {
    return Object.freeze(listForAgent(agent).map(({ name, description, triggers, arguments: args, execution, source, requiresApproval }) => Object.freeze({ name, description, triggers, arguments: args, execution, source, requiresApproval })));
  }

  function selectForAgent(agent, query, options) {
    return createSkillSelector(describePublic(agent)).select(query, options);
  }

  return Object.freeze({ registry, listForAgent, resolveForAgent, describePublic, selectForAgent, size: registry.size });
}

export const SKILLS_RUNTIME_DEFAULTS = Object.freeze({ maxSkills: MAX_SKILLS, builtinSource: 'builtin', defaultExecution: 'inline' });
