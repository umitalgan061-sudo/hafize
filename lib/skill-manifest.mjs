const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-zA-Z0-9_]{0,39}$/;
const MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,119}$/;
const SCOPE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,199}$/;

export const SKILL_SOURCES = Object.freeze(['builtin', 'user', 'project']);
export const SKILL_EXECUTION_MODES = Object.freeze(['inline', 'fork']);
export const SKILL_ARGUMENT_TYPES = Object.freeze(['string', 'number', 'boolean']);
/** Düşük indeks daha yüksek güven: düşük güvenli kaynak yüksek güvenli adı gölgeleyemez. */
export const SKILL_SOURCE_TRUST = Object.freeze({ builtin: 0, user: 1, project: 2 });

const NEVER_SKILL_PERMISSIONS = new Set(['secret.read', 'repo.delete', 'repo.merge']);
const APPROVAL_ONLY_PERMISSIONS = new Set(['external.write', 'external.send', 'repo.write_branch']);
const CREDENTIAL_PATTERNS = [
  /-----BEGIN[A-Z ]*PRIVATE KEY-----/,
  /\b(?:sk|nvapi|ghp|gho|ghs|github_pat)[-_][A-Za-z0-9_-]{16,}/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:client_secret|api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd)\s*[:=]\s*\S/i,
  /\bBearer\s+[A-Za-z0-9._-]{16,}/
];

function fail(field) { throw new Error(`INVALID_SKILL_MANIFEST:${field}`); }

function text(value, field, maxLength) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > maxLength) fail(field);
  return normalized;
}

function textList(value, field, maxItems, maxLength) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > maxItems) fail(field);
  const seen = new Set();
  return Object.freeze(value.map((entry) => {
    const item = text(entry, `${field}.item`, maxLength);
    const key = item.toLocaleLowerCase('tr');
    if (seen.has(key)) fail(`${field}.duplicate`);
    seen.add(key);
    return item;
  }));
}

function permissionList(value, field) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > 16) fail(field);
  const permissions = new Set();
  for (const entry of value) {
    const permission = typeof entry === 'string' ? entry.trim() : '';
    if (!PERMISSION_PATTERN.test(permission)) fail(`${field}.permission`);
    if (permissions.has(permission)) fail(`${field}.duplicate:${permission}`);
    if (NEVER_SKILL_PERMISSIONS.has(permission)) fail(`${field}.forbidden:${permission}`);
    if (APPROVAL_ONLY_PERMISSIONS.has(permission)) fail(`${field}.approvalRequired:${permission}`);
    permissions.add(permission);
  }
  return Object.freeze([...permissions]);
}

function argumentList(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > 8) fail('arguments');
  const names = new Set();
  return Object.freeze(value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail('arguments.item');
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!ARGUMENT_NAME_PATTERN.test(name)) fail('arguments.name');
    if (names.has(name)) fail(`arguments.duplicate:${name}`);
    if (!SKILL_ARGUMENT_TYPES.includes(entry.type)) fail(`arguments.type:${name}`);
    if (entry.required !== undefined && typeof entry.required !== 'boolean') fail(`arguments.required:${name}`);
    names.add(name);
    return Object.freeze({
      name,
      type: entry.type,
      required: entry.required === true,
      description: entry.description == null ? '' : text(entry.description, `arguments.description:${name}`, 300)
    });
  }));
}

export function containsCredentialLike(value) {
  return typeof value === 'string' && value !== '' && CREDENTIAL_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Strict skill manifest doğrulaması. Manifest veridir; talimat veya yetki kaynağı değildir.
 * Doğrulama başarısızsa skill sessizce atlanmaz, hata fırlatılır.
 */
export function normalizeSkillManifest(manifest, { allowedProjectScopes = [] } = {}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) fail('manifest');
  if (manifest.schemaVersion !== 1) fail('schemaVersion');
  const id = typeof manifest.id === 'string' ? manifest.id.trim() : '';
  if (!ID_PATTERN.test(id)) fail('id');
  const source = manifest.source;
  if (!SKILL_SOURCES.includes(source)) fail('source');
  const execution = manifest.execution === undefined ? 'inline' : manifest.execution;
  if (!SKILL_EXECUTION_MODES.includes(execution)) fail('execution');

  const name = text(manifest.name, 'name', 80);
  const description = text(manifest.description, 'description', 500);
  const prompt = text(manifest.prompt, 'prompt', 20_000);
  if (containsCredentialLike(prompt) || containsCredentialLike(description)) fail('prompt.secret');

  let model = null;
  if (manifest.model != null) {
    model = text(manifest.model, 'model', 120);
    if (!MODEL_PATTERN.test(model)) fail('model');
  }

  let projectScope = null;
  if (source === 'project') {
    projectScope = text(manifest.projectScope, 'projectScope', 200);
    if (!SCOPE_PATTERN.test(projectScope)) fail('projectScope');
    if (!Array.isArray(allowedProjectScopes) || !allowedProjectScopes.includes(projectScope)) {
      fail(`projectScope.notAllowed:${projectScope}`);
    }
  } else if (manifest.projectScope != null) fail('projectScope.unexpected');

  return Object.freeze({
    schemaVersion: 1,
    id,
    name,
    description,
    source,
    execution,
    triggers: textList(manifest.triggers, 'triggers', 12, 120),
    allowedTools: permissionList(manifest.allowedTools, 'allowedTools'),
    arguments: argumentList(manifest.arguments),
    model,
    projectScope,
    prompt
  });
}

/** Prompt ve ham izin listesi istemciye açılmaz. */
export function publicSkillView(skill) {
  const { id, name, description, source, execution, triggers } = skill;
  return Object.freeze({ id, name, description, source, execution, triggers, arguments: skill.arguments });
}
