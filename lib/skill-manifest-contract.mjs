const TOP_FIELDS = new Set(['name', 'description', 'triggers', 'allowedTools', 'arguments', 'model', 'execution', 'prompt']);
const ARGUMENT_FIELDS = new Set(['name', 'description', 'required']);
const SKILL_SOURCES = Object.freeze(['builtin', 'user', 'project']);
const EXECUTION_MODES = new Set(['inline', 'fork']);
const NAME_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._\/-]{0,119}$/i;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const NEVER_SKILL_PERMISSIONS = new Set(['secret.read', 'repo.delete']);
const APPROVAL_ONLY_PERMISSIONS = new Set(['external.write', 'external.send', 'repo.merge', 'repo.write_branch']);
const SECRET_MATERIAL_PATTERNS = [
  /process\s*\.\s*env/i,
  /\$\{?[A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE_KEY)[A-Z0-9_]*\}?/,
  /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|password|credential|private[_-]?key)\b\s*[:=]\s*\S/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/
];
const LIMITS = Object.freeze({
  maxDescriptionLength: 500, maxTriggers: 12, maxTriggerLength: 200, maxAllowedTools: 16,
  maxArguments: 8, maxArgumentDescriptionLength: 300, maxPromptLength: 20_000
});

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function rejectSecretMaterial(value) {
  for (const pattern of SECRET_MATERIAL_PATTERNS) if (pattern.test(value)) fail('SKILL_SECRET_MATERIAL');
}

function text(value, code, maxLength) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > maxLength || normalized.includes('\0')) fail(code);
  return normalized;
}

function normalizeTriggers(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > LIMITS.maxTriggers) fail('INVALID_SKILL_TRIGGERS');
  const triggers = [];
  const seen = new Set();
  for (const item of value) {
    const trigger = text(item, 'INVALID_SKILL_TRIGGER', LIMITS.maxTriggerLength);
    if (seen.has(trigger.toLowerCase())) fail('INVALID_SKILL_TRIGGER');
    seen.add(trigger.toLowerCase());
    triggers.push(trigger);
  }
  return Object.freeze(triggers);
}

function normalizeAllowedTools(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > LIMITS.maxAllowedTools) fail('INVALID_SKILL_ALLOWED_TOOLS');
  const tools = [];
  const seen = new Set();
  for (const item of value) {
    const permission = typeof item === 'string' ? item.trim() : '';
    if (!PERMISSION_PATTERN.test(permission) || seen.has(permission)) fail('INVALID_SKILL_ALLOWED_TOOL');
    if (NEVER_SKILL_PERMISSIONS.has(permission)) fail('SKILL_FORBIDDEN_PERMISSION');
    if (APPROVAL_ONLY_PERMISSIONS.has(permission)) fail('SKILL_APPROVAL_PERMISSION_NOT_DECLARABLE');
    seen.add(permission);
    tools.push(permission);
  }
  return Object.freeze(tools);
}

function normalizeArguments(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > LIMITS.maxArguments) fail('INVALID_SKILL_ARGUMENTS');
  const args = [];
  const seen = new Set();
  for (const item of value) {
    if (!item || Array.isArray(item) || typeof item !== 'object') fail('INVALID_SKILL_ARGUMENT');
    for (const field of Object.keys(item)) if (!ARGUMENT_FIELDS.has(field)) fail('INVALID_SKILL_ARGUMENT');
    if (item.required != null && typeof item.required !== 'boolean') fail('INVALID_SKILL_ARGUMENT');
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!ARGUMENT_NAME_PATTERN.test(name) || seen.has(name)) fail('INVALID_SKILL_ARGUMENT_NAME');
    seen.add(name);
    const description = text(item.description, 'INVALID_SKILL_ARGUMENT_DESCRIPTION', LIMITS.maxArgumentDescriptionLength);
    rejectSecretMaterial(description);
    args.push(Object.freeze({ name, description, required: item.required === true }));
  }
  return Object.freeze(args);
}

export function normalizeSkillManifest(input = {}, { source } = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_SKILL_MANIFEST');
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail('INVALID_SKILL_FIELD');
  if (!SKILL_SOURCES.includes(source)) fail('INVALID_SKILL_SOURCE');

  const name = typeof input.name === 'string' ? input.name.trim().toLowerCase() : '';
  if (!NAME_PATTERN.test(name)) fail('INVALID_SKILL_NAME');
  const description = text(input.description, 'INVALID_SKILL_DESCRIPTION', LIMITS.maxDescriptionLength);
  const prompt = text(input.prompt, 'INVALID_SKILL_PROMPT', LIMITS.maxPromptLength);
  rejectSecretMaterial(description);
  rejectSecretMaterial(prompt);

  const model = input.model == null ? null : text(input.model, 'INVALID_SKILL_MODEL', 120);
  if (model !== null && !MODEL_PATTERN.test(model)) fail('INVALID_SKILL_MODEL');
  const execution = input.execution == null ? 'inline' : input.execution;
  if (!EXECUTION_MODES.has(execution)) fail('INVALID_SKILL_EXECUTION');

  return Object.freeze({
    name,
    source,
    description,
    triggers: normalizeTriggers(input.triggers),
    allowedTools: normalizeAllowedTools(input.allowedTools),
    arguments: normalizeArguments(input.arguments),
    model,
    execution,
    prompt
  });
}

export const SKILL_MANIFEST_LIMITS = LIMITS;
export const SKILL_MANIFEST_SOURCES = SKILL_SOURCES;
