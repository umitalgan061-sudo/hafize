// Hafize skill manifest sözleşmesi.
//
// Bir skill; adı, açıklaması, tetikleyicileri, izin verilen araçları,
// argümanları, model tercihi ve execution context'i ayrı ayrı doğrulanan
// kapalı bir sözleşmedir. Manifest kendi yetkisini yükseltemez ve prompt'una
// secret/credential taşıyamaz.

const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-zA-Z0-9_]{0,63}$/;
const MODEL_PATTERN = /^[a-z][a-z0-9._/-]{0,95}$/;

export const SKILL_SOURCES = Object.freeze(['builtin', 'user', 'project']);
export const SKILL_EXECUTIONS = Object.freeze(['inline', 'fork']);
export const SKILL_ARGUMENT_TYPES = Object.freeze(['string', 'number', 'boolean']);

// Bir skill bu izinleri hiçbir koşulda isteyemez.
export const NEVER_SKILL_PERMISSIONS = Object.freeze(['secret.read', 'repo.delete']);
// Bu izinler yalnızca kullanıcı onayıyla ve agent politikası üzerinden gelir;
// skill manifesti bunları kendi başına veremez.
export const APPROVAL_ONLY_PERMISSIONS = Object.freeze([
  'external.write',
  'external.send',
  'repo.merge',
  'repo.write_branch'
]);

const CREDENTIAL_PATTERNS = [
  /\b(?:api[_-]?key|secret|password|passwd|client[_-]?secret|private[_-]?key|access[_-]?token|refresh[_-]?token|authorization|bearer)\b\s*[:=]/i,
  /\b(?:sk|nvapi|ghp|gho|github_pat)[_-][A-Za-z0-9_-]{16,}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bprocess\.env\b/,
  /\$\{?[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)S?\}?/
];

const ALLOWED_KEYS = new Set([
  'id', 'name', 'description', 'triggers', 'allowedTools',
  'arguments', 'model', 'execution', 'prompt', 'projectScope'
]);

function fail(label) { throw new Error(`INVALID_SKILL_MANIFEST:${label}`); }

function text(value, label, { min = 1, max = 500 } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < min || normalized.length > max) fail(label);
  return normalized;
}

function assertNoCredential(value, label) {
  for (const pattern of CREDENTIAL_PATTERNS) {
    if (pattern.test(value)) throw new Error(`SKILL_PROMPT_CREDENTIAL_REJECTED:${label}`);
  }
}

function stringList(value, label, { max = 12, maxLength = 200 } = {}) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > max) fail(label);
  const items = [];
  for (const item of value) {
    const normalized = text(item, `${label}.item`, { max: maxLength });
    if (items.includes(normalized)) fail(`${label}.duplicate`);
    items.push(normalized);
  }
  return items;
}

function permissionList(value, label) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 16) fail(label);
  const permissions = [];
  for (const item of value) {
    const permission = typeof item === 'string' ? item.trim() : '';
    if (!PERMISSION_PATTERN.test(permission)) fail(`${label}.permission`);
    if (permissions.includes(permission)) fail(`${label}.duplicate:${permission}`);
    if (NEVER_SKILL_PERMISSIONS.includes(permission)) {
      throw new Error(`SKILL_PERMISSION_FORBIDDEN:${permission}`);
    }
    if (APPROVAL_ONLY_PERMISSIONS.includes(permission)) {
      throw new Error(`SKILL_PERMISSION_ESCALATION:${permission}`);
    }
    permissions.push(permission);
  }
  return permissions;
}

function argumentList(value, label) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 12) fail(label);
  const args = [];
  const names = new Set();
  for (const item of value) {
    if (!item || Array.isArray(item) || typeof item !== 'object') fail(`${label}.item`);
    for (const key of Object.keys(item)) {
      if (!['name', 'type', 'required', 'description'].includes(key)) fail(`${label}.${key}`);
    }
    const name = text(item.name, `${label}.name`, { max: 64 });
    if (!ARGUMENT_NAME_PATTERN.test(name)) fail(`${label}.name`);
    if (names.has(name)) fail(`${label}.duplicate:${name}`);
    const type = text(item.type, `${label}.type`, { max: 16 });
    if (!SKILL_ARGUMENT_TYPES.includes(type)) fail(`${label}.type`);
    if (item.required !== undefined && typeof item.required !== 'boolean') fail(`${label}.required`);
    const description = text(item.description, `${label}.description`, { max: 300 });
    assertNoCredential(description, `arguments.${name}.description`);
    names.add(name);
    args.push(Object.freeze({ name, type, required: item.required === true, description }));
  }
  return args;
}

function normalizeProjectScope(value, source) {
  if (source !== 'project') {
    if (value !== undefined) fail('projectScope.notProject');
    return null;
  }
  const scope = text(value, 'projectScope', { max: 200 });
  if (scope.startsWith('/') || scope.includes('\\') || scope.includes('\0')) fail('projectScope');
  if (scope.split('/').includes('..') || scope.startsWith('~')) fail('projectScope.escape');
  return scope;
}

export function normalizeSkillManifest(input, { source } = {}) {
  if (!SKILL_SOURCES.includes(source)) fail('source');
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('manifest');
  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) fail(`unknownField:${key}`);
  }

  const id = text(input.id, 'id', { max: 64 });
  if (!ID_PATTERN.test(id)) fail('id');

  const name = text(input.name, 'name', { max: 120 });
  const description = text(input.description, 'description', { max: 500 });
  const prompt = text(input.prompt, 'prompt', { min: 8, max: 8000 });
  const triggers = stringList(input.triggers, 'triggers');
  const allowedTools = permissionList(input.allowedTools, 'allowedTools');
  const args = argumentList(input.arguments, 'arguments');

  const execution = text(input.execution, 'execution', { max: 16 });
  if (!SKILL_EXECUTIONS.includes(execution)) fail('execution');

  let model = null;
  if (input.model !== undefined) {
    model = text(input.model, 'model', { max: 96 });
    if (!MODEL_PATTERN.test(model)) fail('model');
  }

  // Prompt ve kullanıcıya görünen metinler secret/credential taşıyamaz.
  assertNoCredential(prompt, 'prompt');
  assertNoCredential(description, 'description');
  for (const trigger of triggers) assertNoCredential(trigger, 'triggers');

  return Object.freeze({
    id,
    name,
    description,
    source,
    execution,
    model,
    triggers: Object.freeze(triggers),
    allowedTools: Object.freeze(allowedTools),
    arguments: Object.freeze(args),
    projectScope: normalizeProjectScope(input.projectScope, source),
    prompt
  });
}
