import { readFile } from 'node:fs/promises';
import { readFileSync as readTextFileSync } from 'node:fs';
import { createSkillsRegistry } from './skills-registry.mjs';
import { createSkillSelector } from './skill-selector.mts';

const DEFAULT_BUILTIN_URL = new URL('../skills/builtin.json', import.meta.url);
const MAX_SKILLS = 64;

function fail(code) {
  const error = /** @type {HafizeCodedError} */ (new Error(code));
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

/**
 * @param {unknown} raw
 * @param {string[]} allowedProjects
 * @param {typeof createSkillsRegistry} [createRegistry]
 */
function buildRuntime(raw, allowedProjects, createRegistry = createSkillsRegistry) {
  const registry = createRegistry({ allowedProjects: normalizeProjectList(allowedProjects) });
  for (const manifest of readBuiltinManifests(raw)) registry.register(manifest, { source: 'builtin' });

  // The runtime layer resolves a skill against the tools the agent already has:
  // declared tools the policy denies are dropped instead of hiding the skill.
  /** @param {Record<string, any>} agent */
  function listForAgent(agent) {
    return registry.listForAgent(agent, { intersectTools: true });
  }

  /**
   * @param {Record<string, any>} agent
   * @param {string} query
   * @param {Record<string, any>} [options]
   */
  function selectForAgent(agent, query, options) {
    if (!agent || typeof agent !== 'object') fail('INVALID_SKILL_AGENT');
    return createSkillSelector(listForAgent(agent)).select(query, options);
  }

  /**
   * @param {Record<string, any>} agent
   * @param {string} query
   */
  function rankForAgent(agent, query) {
    if (!agent || typeof agent !== 'object') fail('INVALID_SKILL_AGENT');
    return createSkillSelector(listForAgent(agent)).rank(query);
  }

  /** @param {{ agent?: any; skillId?: string; args?: Record<string, any>; approvalGranted?: boolean }} [input] */
  function resolveForAgent({ agent, skillId, args = {}, approvalGranted = false } = {}) {
    const id = typeof skillId === 'string' ? skillId.trim() : '';
    if (!id) return null;
    return Object.freeze(registry.resolveInvocation({
      agent,
      name: id,
      args,
      approvalGranted: approvalGranted === true,
      intersectTools: true
    }));
  }

  /** @param {Record<string, any>} agent */
  function describePublic(agent) {
    return Object.freeze(listForAgent(agent).map(({ name, description, triggers, arguments: args, execution, source, requiresApproval }) => Object.freeze({
      name, description, triggers, arguments: args, execution, source, requiresApproval
    })));
  }

  return Object.freeze({ registry, listForAgent, selectForAgent, rankForAgent, resolveForAgent, describePublic, size: registry.size });
}

/**
 * @param {{ fileUrl?: URL | string; allowedProjects?: string[]; readFileImpl?: Function; createRegistry?: typeof createSkillsRegistry }} [options]
 */
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
  return buildRuntime(raw, allowedProjects, createRegistry);
}

/**
 * @param {{ fileUrl?: URL | string; allowedProjects?: string[]; readFileImpl?: Function; createRegistry?: typeof createSkillsRegistry }} [options]
 */
export function createBuiltinSkillsRuntimeSync({
  fileUrl = DEFAULT_BUILTIN_URL,
  allowedProjects = [],
  readFileImpl = readTextFileSync,
  createRegistry = createSkillsRegistry
} = {}) {
  if (typeof readFileImpl !== 'function') fail('INVALID_SKILL_RUNTIME_READER');
  if (typeof createRegistry !== 'function') fail('INVALID_SKILL_RUNTIME_REGISTRY');
  let raw;
  try {
    raw = JSON.parse(readFileImpl(fileUrl, 'utf8'));
  } catch {
    fail('SKILL_CATALOG_UNREADABLE');
  }
  return buildRuntime(raw, allowedProjects, createRegistry);
}

export const SKILLS_RUNTIME_DEFAULTS = Object.freeze({
  maxSkills: MAX_SKILLS,
  builtinSource: 'builtin',
  defaultExecution: 'inline'
});
