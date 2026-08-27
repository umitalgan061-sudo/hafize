const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._/-]{1,79}$/;
const ARGUMENT_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

const NEVER_SKILL_PERMISSIONS = new Set(['secret.read', 'repo.delete']);
const APPROVAL_ONLY_PERMISSIONS = new Set(['external.write', 'external.send', 'repo.merge', 'repo.write_branch']);

const SECRET_PATTERNS = [
  /\b(api[_-]?key|access[_-]?token|client[_-]?secret|refresh[_-]?token|password)\b\s*[:=]/i,
  /\bbearer\s+[a-z0-9._-]{12,}/i,
  /\bprocess\.env\b/,
  /\$\{?[A-Z][A-Z0-9_]{4,}\}?/,
  /\b(sk-[a-z0-9]{16,}|ghp_[a-z0-9]{20,}|xox[abpr]-[a-z0-9-]{10,}|nvapi-[a-z0-9_-]{16,})/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/
];

export const SKILL_SOURCES = Object.freeze(['builtin', 'user', 'project']);
export const SKILL_EXECUTION_MODES = Object.freeze(['inline', 'fork']);
export const SKILL_ARGUMENT_TYPES = Object.freeze(['string', 'number', 'boolean']);

export const SKILL_MANIFEST_LIMITS = Object.freeze({
  maxNameChars: 80,
  maxDescriptionChars: 400,
  maxTriggers: 12,
  maxTriggerChars: 60,
  maxAllowedTools: 16,
  maxArguments: 8,
  maxPromptChars: 8000
});

const ALLOWED_KEYS = new Set([
  'id',
  'name',
  'description',
  'version',
  'triggers',
  'allowedTools',
  'arguments',
  'model',
  'execution',
  'prompt'
]);

function invalid(field) {
  return { ok: false, error: `INVALID_SKILL_MANIFEST:${field}` };
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function containsSecretLikeContent(value) {
  return SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

function normalizeTriggers(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > SKILL_MANIFEST_LIMITS.maxTriggers) return null;

  const triggers = [];
  for (const item of value) {
    const trigger = text(item).toLowerCase();
    if (trigger.length < 2 || trigger.length > SKILL_MANIFEST_LIMITS.maxTriggerChars) return null;
    if (triggers.includes(trigger)) return null;
    triggers.push(trigger);
  }
  return triggers;
}

function normalizeAllowedTools(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > SKILL_MANIFEST_LIMITS.maxAllowedTools) return null;

  const tools = [];
  for (const item of value) {
    const tool = text(item);
    if (!PERMISSION_PATTERN.test(tool)) return null;
    if (tools.includes(tool)) return null;
    if (NEVER_SKILL_PERMISSIONS.has(tool) || APPROVAL_ONLY_PERMISSIONS.has(tool)) return null;
    tools.push(tool);
  }
  return tools;
}

function normalizeArguments(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > SKILL_MANIFEST_LIMITS.maxArguments) return null;

  const args = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const name = text(item.name);
    if (!ARGUMENT_PATTERN.test(name)) return null;
    if (args.some((argument) => argument.name === name)) return null;
    const type = item.type === undefined ? 'string' : item.type;
    if (!SKILL_ARGUMENT_TYPES.includes(type)) return null;
    if (item.required !== undefined && typeof item.required !== 'boolean') return null;
    const description = item.description === undefined ? '' : text(item.description);
    if (item.description !== undefined && (!description || description.length > 200)) return null;
    args.push(Object.freeze({ name, type, required: item.required === true, description }));
  }
  return args;
}

export function normalizeSkillManifest(input, { source } = {}) {
  if (!SKILL_SOURCES.includes(source)) return invalid('source');
  if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid('manifest');

  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) return invalid(`unknownKey:${key}`);
  }

  const id = text(input.id);
  if (!ID_PATTERN.test(id)) return invalid('id');

  const name = text(input.name);
  if (!name || name.length > SKILL_MANIFEST_LIMITS.maxNameChars) return invalid('name');

  const description = text(input.description);
  if (!description || description.length > SKILL_MANIFEST_LIMITS.maxDescriptionChars) return invalid('description');

  const version = input.version === undefined ? '1.0.0' : text(input.version);
  if (!VERSION_PATTERN.test(version)) return invalid('version');

  const triggers = normalizeTriggers(input.triggers);
  if (!triggers) return invalid('triggers');

  const allowedTools = normalizeAllowedTools(input.allowedTools);
  if (!allowedTools) return invalid('allowedTools');

  const args = normalizeArguments(input.arguments);
  if (!args) return invalid('arguments');

  const model = input.model === undefined ? '' : text(input.model).toLowerCase();
  if (input.model !== undefined && !MODEL_PATTERN.test(model)) return invalid('model');

  const execution = input.execution === undefined ? 'inline' : text(input.execution);
  if (!SKILL_EXECUTION_MODES.includes(execution)) return invalid('execution');

  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
  if (!prompt || prompt.length > SKILL_MANIFEST_LIMITS.maxPromptChars) return invalid('prompt');
  if (containsSecretLikeContent(prompt)) return invalid('prompt.secret');
  if (containsSecretLikeContent(description)) return invalid('description.secret');

  return {
    ok: true,
    skill: Object.freeze({
      id,
      name,
      description,
      version,
      source,
      triggers: Object.freeze(triggers),
      allowedTools: Object.freeze(allowedTools),
      arguments: Object.freeze(args),
      model,
      execution,
      prompt
    })
  };
}
