const ID_PATTERN = /^[a-z][a-z0-9-]{2,63}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const ARGUMENT_PATTERN = /^[a-z][a-zA-Z0-9_]{0,39}$/;
const MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{2,80}$/;
const SCOPE_PATTERN = /^[a-z][a-z0-9._/-]{1,120}$/;
const TRIGGER_PATTERN = /^[\p{Ll}\p{N}][\p{Ll}\p{N} ._/-]{1,59}$/u;

const MANIFEST_FIELDS = new Set([
  'id', 'name', 'description', 'source', 'execution', 'triggers',
  'allowedTools', 'arguments', 'model', 'prompt', 'projectScope'
]);
const ARGUMENT_FIELDS = new Set(['name', 'description', 'required']);

const CREDENTIAL_MARKERS = [
  /api[_-]?key/i, /secret/i, /password/i, /private[_-]?key/i, /credential/i,
  /(access|refresh|auth|bearer)[_-]?token/i, /process\.env/i, /authorization:\s*bearer/i
];

export const SKILL_SOURCES = Object.freeze(['builtin', 'user', 'project']);
export const SKILL_EXECUTION_MODES = Object.freeze(['inline', 'fork']);

/** Bir skill bu izinleri hiçbir kaynaktan talep edemez. */
export const SKILL_FORBIDDEN_TOOLS = Object.freeze(['secret.read', 'repo.delete']);

/** Bir skill bu izinleri kendi manifesti ile veremez; yalnız kullanıcı onayı verir. */
export const SKILL_APPROVAL_ONLY_TOOLS = Object.freeze([
  'external.write', 'external.send', 'repo.merge', 'repo.write_branch'
]);

const MAX_TRIGGERS = 10;
const MAX_TOOLS = 12;
const MAX_ARGUMENTS = 6;
const MAX_PROMPT = 8000;

function fail(field) { throw new Error(`INVALID_SKILL_MANIFEST:${field}`); }

function requireExactFields(input, allowed, label) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail(label);
  for (const key of Object.keys(input)) if (!allowed.has(key)) fail(`${label}.field:${key}`);
}

function text(value, field, maxLength) {
  const clean = typeof value === 'string' ? value.trim() : '';
  if (!clean || clean.length > maxLength) fail(field);
  return clean;
}

function assertNoCredentialMarker(value, field) {
  if (CREDENTIAL_MARKERS.some((marker) => marker.test(value))) fail(`${field}.credential`);
}

function normalizeTriggers(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_TRIGGERS) fail('triggers');
  const triggers = [];
  for (const item of value) {
    const trigger = typeof item === 'string' ? item.trim().toLowerCase() : '';
    if (!TRIGGER_PATTERN.test(trigger)) fail('triggers.value');
    if (triggers.includes(trigger)) fail(`triggers.duplicate:${trigger}`);
    triggers.push(trigger);
  }
  return Object.freeze(triggers);
}

function normalizeAllowedTools(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_TOOLS) fail('allowedTools');
  const tools = [];
  for (const item of value) {
    const tool = typeof item === 'string' ? item.trim() : '';
    if (!PERMISSION_PATTERN.test(tool)) fail('allowedTools.value');
    if (tools.includes(tool)) fail(`allowedTools.duplicate:${tool}`);
    if (SKILL_FORBIDDEN_TOOLS.includes(tool)) fail(`allowedTools.forbidden:${tool}`);
    if (SKILL_APPROVAL_ONLY_TOOLS.includes(tool)) fail(`allowedTools.approvalOnly:${tool}`);
    tools.push(tool);
  }
  return Object.freeze(tools);
}

function normalizeArguments(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_ARGUMENTS) fail('arguments');
  const args = [];
  const names = new Set();
  for (const item of value) {
    requireExactFields(item, ARGUMENT_FIELDS, 'arguments');
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!ARGUMENT_PATTERN.test(name)) fail('arguments.name');
    if (names.has(name)) fail(`arguments.duplicate:${name}`);
    if (item.required !== undefined && typeof item.required !== 'boolean') fail('arguments.required');
    const description = item.description === undefined ? '' : text(item.description, 'arguments.description', 200);
    if (description) assertNoCredentialMarker(description, 'arguments.description');
    names.add(name);
    args.push(Object.freeze({ name, description, required: item.required === true }));
  }
  return Object.freeze(args);
}

function normalizeProjectScope(manifest, source, allowedProjectScopes) {
  if (source !== 'project') {
    if (manifest.projectScope !== undefined) fail('projectScope.unexpected');
    return null;
  }
  const scope = text(manifest.projectScope, 'projectScope', 120);
  if (!SCOPE_PATTERN.test(scope)) fail('projectScope');
  if (!Array.isArray(allowedProjectScopes) || allowedProjectScopes.length === 0) fail('projectScope.notAllowed');
  if (!allowedProjectScopes.includes(scope)) fail(`projectScope.notAllowed:${scope}`);
  return scope;
}

export function normalizeSkillManifest(input, { source, allowedProjectScopes = [] } = {}) {
  if (!SKILL_SOURCES.includes(source)) fail('source');
  requireExactFields(input, MANIFEST_FIELDS, 'manifest');

  if (input.source !== undefined && input.source !== source) fail('source.mismatch');

  const id = text(input.id, 'id', 64);
  if (!ID_PATTERN.test(id)) fail('id');

  const name = text(input.name, 'name', 80);
  const description = text(input.description, 'description', 400);
  assertNoCredentialMarker(description, 'description');
  const execution = text(input.execution, 'execution', 16);
  if (!SKILL_EXECUTION_MODES.includes(execution)) fail('execution');
  const prompt = text(input.prompt, 'prompt', MAX_PROMPT);
  assertNoCredentialMarker(prompt, 'prompt');
  let model = null;
  if (input.model !== undefined) {
    model = text(input.model, 'model', 80);
    if (!MODEL_PATTERN.test(model)) fail('model');
  }

  return Object.freeze({
    id,
    name,
    description,
    source,
    execution,
    triggers: normalizeTriggers(input.triggers),
    allowedTools: normalizeAllowedTools(input.allowedTools),
    arguments: normalizeArguments(input.arguments),
    model,
    prompt,
    projectScope: normalizeProjectScope(input, source, allowedProjectScopes)
  });
}
