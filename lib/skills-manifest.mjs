import { authorizeAgentTool } from './agent-runtime.mjs';

const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const SOURCES = Object.freeze(['builtin', 'user', 'project']);
const EXECUTIONS = Object.freeze(['inline', 'fork']);
const ALLOWED_KEYS = new Set([
  'id', 'name', 'description', 'source', 'triggers', 'allowedTools', 'arguments', 'model', 'execution', 'prompt', 'projectScope'
]);
const ARGUMENT_KEYS = new Set(['name', 'description', 'required']);
const NEVER_SKILL_PERMISSIONS = new Set(['secret.read', 'repo.delete', 'repo.merge']);
const APPROVAL_ONLY_PERMISSIONS = new Set(['external.write', 'external.send', 'repo.write_branch']);
const SECRET_PATTERNS = [
  /\b(?:nvapi|sk|ghp|gho|ghs|xoxb|xoxp)-[A-Za-z0-9_-]{8,}/i,
  /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key)\b\s*[:=]/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/
];

function fail(field) {
  throw new Error(`INVALID_SKILL_MANIFEST:${field}`);
}

function text(value, field, { min = 1, max = 2048 } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < min || normalized.length > max) fail(field);
  return normalized;
}

function stringList(value, field, { max = 16, itemMax = 256, required = false } = {}) {
  if (value === undefined) {
    if (required) fail(field);
    return Object.freeze([]);
  }
  if (!Array.isArray(value) || value.length > max || (required && value.length === 0)) fail(field);
  const items = [];
  for (const item of value) {
    const normalized = text(item, `${field}.item`, { max: itemMax });
    if (items.includes(normalized)) fail(`${field}.duplicate`);
    items.push(normalized);
  }
  return Object.freeze(items);
}

function requireNoSecret(value, field) {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(value)) fail(`${field}.secret`);
  }
}

function permissionList(value, field) {
  const permissions = stringList(value, field, { max: 24, itemMax: 120 });
  for (const permission of permissions) {
    if (!PERMISSION_PATTERN.test(permission)) fail(`${field}.permission`);
    if (NEVER_SKILL_PERMISSIONS.has(permission)) fail(`${field}.forbidden:${permission}`);
    if (APPROVAL_ONLY_PERMISSIONS.has(permission)) fail(`${field}.approvalRequired:${permission}`);
  }
  return permissions;
}

function argumentList(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > 12) fail('arguments');
  const names = new Set();
  const args = value.map((item) => {
    if (!item || Array.isArray(item) || typeof item !== 'object') fail('arguments.item');
    for (const key of Object.keys(item)) if (!ARGUMENT_KEYS.has(key)) fail(`arguments.${key}`);
    const name = text(item.name, 'arguments.name', { max: 64 });
    if (!ID_PATTERN.test(name)) fail('arguments.name');
    if (names.has(name)) fail(`arguments.duplicate:${name}`);
    names.add(name);
    const description = text(item.description, 'arguments.description', { max: 512 });
    requireNoSecret(description, 'arguments.description');
    if (item.required !== undefined && typeof item.required !== 'boolean') fail('arguments.required');
    return Object.freeze({ name, description, required: item.required === true });
  });
  return Object.freeze(args);
}

/**
 * Skill manifest'ini strict doğrular. Manifest kendi araç yetkisini yükseltemez,
 * onay gerektiren veya hiçbir zaman verilmeyen izinleri isteyemez ve prompt'una
 * credential/secret gömemez.
 */
export function parseSkillManifest(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('manifest');
  for (const key of Object.keys(input)) if (!ALLOWED_KEYS.has(key)) fail(`manifest.${key}`);

  const id = text(input.id, 'id', { max: 64 });
  if (!ID_PATTERN.test(id)) fail('id');
  const name = text(input.name, 'name', { max: 96 });
  const description = text(input.description, 'description', { max: 512 });
  requireNoSecret(description, 'description');

  const source = text(input.source, 'source', { max: 16 });
  if (!SOURCES.includes(source)) fail('source');
  const execution = input.execution === undefined ? 'inline' : text(input.execution, 'execution', { max: 16 });
  if (!EXECUTIONS.includes(execution)) fail('execution');

  const prompt = text(input.prompt, 'prompt', { max: 20_000 });
  requireNoSecret(prompt, 'prompt');

  const triggers = stringList(input.triggers, 'triggers', { max: 24, itemMax: 128, required: true });
  const allowedTools = permissionList(input.allowedTools, 'allowedTools');
  const args = argumentList(input.arguments);

  let model;
  if (input.model !== undefined) {
    model = text(input.model, 'model', { max: 128 });
    if (!/^[A-Za-z0-9][A-Za-z0-9._\/-]{1,127}$/.test(model)) fail('model');
  }

  // Project skill'leri yalnız açıkça izin verilen proje kapsamından yüklenir.
  let projectScope;
  if (source === 'project') {
    projectScope = text(input.projectScope, 'projectScope', { max: 256 });
    if (!/^[A-Za-z0-9][A-Za-z0-9._\/-]{1,255}$/.test(projectScope) || projectScope.includes('..')) fail('projectScope');
  } else if (input.projectScope !== undefined) {
    fail('projectScope.unexpected');
  }

  return Object.freeze({
    id,
    name,
    description,
    source,
    execution,
    prompt,
    triggers,
    allowedTools,
    arguments: args,
    ...(model ? { model } : {}),
    ...(projectScope ? { projectScope } : {})
  });
}

/**
 * Skill yalnız çalıştıran ajanın halihazırda sahip olduğu araçları görebilir.
 * Ajan izni yoksa veya izin onay gerektiriyorsa skill bu aracı kazanamaz.
 */
export function resolveSkillTools(skill, agent) {
  if (!skill || typeof skill !== 'object') fail('skill');
  if (!agent || typeof agent !== 'object') fail('agent');
  const granted = [];
  const rejected = [];
  for (const permission of skill.allowedTools || []) {
    const decision = authorizeAgentTool(agent, permission);
    if (decision.allowed) granted.push(permission);
    else rejected.push({ permission, reason: decision.reason });
  }
  return Object.freeze({ granted: Object.freeze(granted), rejected: Object.freeze(rejected) });
}

export const SKILL_SOURCES = SOURCES;
export const SKILL_EXECUTIONS = EXECUTIONS;
