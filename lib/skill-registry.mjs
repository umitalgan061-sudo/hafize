import { authorizeAgentTool } from './agent-runtime.mjs';
import { SKILL_SOURCES, normalizeSkillManifest } from './skill-manifest.mjs';

const MAX_SKILLS = 100;
const MAX_ARGUMENT_LENGTH = 2_000;
// Yüksek güvenli kaynak düşük güvenli kaynağı gölgeler: builtin > user > project.
const SOURCE_RANK = new Map(SKILL_SOURCES.map((source, index) => [source, SKILL_SOURCES.length - index]));

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function createSkillRegistry(entries = [], { projectScopeAllowed = false } = {}) {
  if (!Array.isArray(entries) || entries.length > MAX_SKILLS) fail('INVALID_SKILL_REGISTRY');

  const skills = new Map();
  const shadowed = [];
  for (const entry of entries) {
    if (!entry || Array.isArray(entry) || typeof entry !== 'object') fail('INVALID_SKILL_REGISTRY_ENTRY');
    const manifest = normalizeSkillManifest(entry.manifest, { source: entry.source, projectScopeAllowed });

    const existing = skills.get(manifest.id);
    if (!existing) {
      skills.set(manifest.id, manifest);
      continue;
    }
    if (existing.source === manifest.source) fail(`SKILL_ID_DUPLICATE:${manifest.id}`);
    const winner = SOURCE_RANK.get(existing.source) >= SOURCE_RANK.get(manifest.source) ? existing : manifest;
    const loser = winner === existing ? manifest : existing;
    skills.set(manifest.id, winner);
    shadowed.push(Object.freeze({ id: loser.id, source: loser.source, shadowedBy: winner.source }));
  }

  return Object.freeze({
    projectScopeAllowed: projectScopeAllowed === true,
    skills: Object.freeze([...skills.values()]),
    shadowed: Object.freeze(shadowed)
  });
}

export function listPublicSkills(registry) {
  return registry.skills.map(({ id, name, description, source, execution, triggers }) =>
    Object.freeze({ id, name, description, source, execution, triggers })
  );
}

function normalizeSkillArguments(manifest, args) {
  if (args == null) args = {};
  if (Array.isArray(args) || typeof args !== 'object') fail('INVALID_SKILL_ARGUMENT_VALUES');

  const declared = new Map(manifest.arguments.map((argument) => [argument.name, argument]));
  for (const name of Object.keys(args)) if (!declared.has(name)) fail(`UNKNOWN_SKILL_ARGUMENT:${name}`);

  const values = {};
  for (const argument of manifest.arguments) {
    const raw = args[argument.name];
    if (raw == null || raw === '') {
      if (argument.required) fail(`MISSING_SKILL_ARGUMENT:${argument.name}`);
      continue;
    }
    if (typeof raw !== 'string' || raw.length > MAX_ARGUMENT_LENGTH || raw.includes('\0')) {
      fail(`INVALID_SKILL_ARGUMENT_VALUE:${argument.name}`);
    }
    values[argument.name] = raw;
  }
  return Object.freeze(values);
}

export function resolveSkillExecution(
  registry,
  { skillId, agent, args, approvalGranted = false, forkAvailable = false } = {}
) {
  const id = typeof skillId === 'string' ? skillId.trim() : '';
  const manifest = registry?.skills?.find((skill) => skill.id === id);
  if (!manifest) fail('SKILL_NOT_FOUND');
  if (manifest.execution === 'fork' && forkAvailable !== true) fail('SKILL_FORK_NOT_AVAILABLE');

  const values = normalizeSkillArguments(manifest, args);

  // Skill kendi yetkisini yükseltemez: izin kararını her zaman agent policy verir.
  const tools = [];
  const deniedTools = [];
  for (const tool of manifest.allowedTools) {
    const decision = authorizeAgentTool(agent, tool, { approvalGranted });
    if (decision.allowed) tools.push(tool);
    else deniedTools.push(Object.freeze({ tool, reason: decision.reason }));
  }

  return Object.freeze({
    skillId: manifest.id,
    source: manifest.source,
    execution: manifest.execution,
    model: manifest.model,
    tools: Object.freeze(tools),
    deniedTools: Object.freeze(deniedTools),
    arguments: values,
    // Skill prompt'u system yetkisi kazanmaz; user-level talimat olarak taşınır.
    promptMessage: Object.freeze({ role: 'user', content: manifest.prompt })
  });
}
