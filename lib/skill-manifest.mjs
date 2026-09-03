const SOURCES = new Set(['builtin', 'user', 'project']);
const EXECUTIONS = new Set(['inline', 'fork']);
const TOP_FIELDS = new Set([
  'name',
  'description',
  'triggers',
  'allowedTools',
  'approvalRequiredTools',
  'arguments',
  'model',
  'execution',
  'prompt'
]);
const ARGUMENT_FIELDS = new Set(['name', 'type', 'required', 'description']);
const ARGUMENT_TYPES = new Set(['string', 'number', 'boolean']);

const NAME_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._/-]{0,119}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;

const NEVER_SKILL_PERMISSIONS = new Set(['secret.read', 'repo.delete']);
const APPROVAL_ONLY_PERMISSIONS = new Set(['external.write', 'external.send', 'repo.merge', 'repo.write_branch']);

const CREDENTIAL_PATTERNS = [
  /process\.env\b/i,
  /\bsk-[a-z0-9]{8,}/i,
  /\bnvapi-[a-z0-9_-]{8,}/i,
  /\bgh[pousr]_[a-z0-9]{16,}/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(api[_\s-]?key|access[_\s-]?token|refresh[_\s-]?token|client[_\s-]?secret|password)\b\s*[:=]/i
];

export const SKILL_SOURCE_PRECEDENCE = Object.freeze({ builtin: 3, user: 2, project: 1 });

export const SKILL_MANIFEST_LIMITS = Object.freeze({
  maxDescriptionLength: 400,
  maxTriggers: 12,
  maxTriggerLength: 80,
  maxTools: 16,
  maxArguments: 8,
  maxPromptLength: 20_000
});

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function cleanLine(value, maxLength, code) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || /[\r\n\0]/.test(text)) fail(code);
  return text;
}

function normalizeTriggers(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > SKILL_MANIFEST_LIMITS.maxTriggers) fail('INVALID_SKILL_TRIGGERS');

  const triggers = [];
  const seen = new Set();
  for (const item of value) {
    const trigger = cleanLine(item, SKILL_MANIFEST_LIMITS.maxTriggerLength, 'INVALID_SKILL_TRIGGERS').toLowerCase();
    if (seen.has(trigger)) fail('INVALID_SKILL_TRIGGERS');
    seen.add(trigger);
    triggers.push(trigger);
  }
  return Object.freeze(triggers);
}

function normalizePermissions(value, code) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > SKILL_MANIFEST_LIMITS.maxTools) fail(code);

  const permissions = [];
  const seen = new Set();
  for (const item of value) {
    const permission = typeof item === 'string' ? item.trim() : '';
    if (!PERMISSION_PATTERN.test(permission) || seen.has(permission)) fail(code);
    if (NEVER_SKILL_PERMISSIONS.has(permission)) fail('SKILL_FORBIDDEN_TOOL');
    seen.add(permission);
    permissions.push(permission);
  }
  return Object.freeze(permissions);
}

function normalizeArguments(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > SKILL_MANIFEST_LIMITS.maxArguments) fail('INVALID_SKILL_ARGUMENTS');

  const args = [];
  const seen = new Set();
  for (const item of value) {
    if (!item || Array.isArray(item) || typeof item !== 'object') fail('INVALID_SKILL_ARGUMENTS');
    for (const field of Object.keys(item)) if (!ARGUMENT_FIELDS.has(field)) fail('INVALID_SKILL_ARGUMENT_FIELD');

    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!ARGUMENT_NAME_PATTERN.test(name) || seen.has(name)) fail('INVALID_SKILL_ARGUMENTS');
    if (!ARGUMENT_TYPES.has(item.type)) fail('INVALID_SKILL_ARGUMENTS');
    if (item.required != null && typeof item.required !== 'boolean') fail('INVALID_SKILL_ARGUMENTS');
    seen.add(name);

    args.push(Object.freeze({
      name,
      type: item.type,
      required: item.required === true,
      description: item.description == null
        ? ''
        : cleanLine(item.description, SKILL_MANIFEST_LIMITS.maxDescriptionLength, 'INVALID_SKILL_ARGUMENTS')
    }));
  }
  return Object.freeze(args);
}

function normalizePrompt(value) {
  if (typeof value !== 'string') fail('INVALID_SKILL_PROMPT');
  const prompt = value.trim();
  if (!prompt || prompt.length > SKILL_MANIFEST_LIMITS.maxPromptLength || prompt.includes('\0')) {
    fail('INVALID_SKILL_PROMPT');
  }
  for (const pattern of CREDENTIAL_PATTERNS) {
    if (pattern.test(prompt)) fail('SKILL_PROMPT_CREDENTIAL_FORBIDDEN');
  }
  return prompt;
}

export function normalizeSkillManifest(input = {}, { source, projectScopeAllowed = false } = {}) {
  if (!SOURCES.has(source)) fail('INVALID_SKILL_SOURCE');
  if (source === 'project' && projectScopeAllowed !== true) fail('SKILL_PROJECT_SCOPE_NOT_ALLOWED');
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_SKILL_MANIFEST');
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail('INVALID_SKILL_FIELD');

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!NAME_PATTERN.test(name)) fail('INVALID_SKILL_NAME');
  if (!EXECUTIONS.has(input.execution)) fail('INVALID_SKILL_EXECUTION');

  const allowedTools = normalizePermissions(input.allowedTools, 'INVALID_SKILL_TOOLS');
  const approvalRequiredTools = normalizePermissions(input.approvalRequiredTools, 'INVALID_SKILL_TOOLS');
  for (const permission of allowedTools) {
    if (APPROVAL_ONLY_PERMISSIONS.has(permission)) fail('SKILL_APPROVAL_REQUIRED_TOOL');
    if (approvalRequiredTools.includes(permission)) fail('INVALID_SKILL_TOOLS');
  }

  const model = input.model == null ? null : cleanLine(input.model, 120, 'INVALID_SKILL_MODEL');
  if (model !== null && !MODEL_PATTERN.test(model)) fail('INVALID_SKILL_MODEL');

  return Object.freeze({
    name,
    source,
    precedence: SKILL_SOURCE_PRECEDENCE[source],
    description: cleanLine(input.description, SKILL_MANIFEST_LIMITS.maxDescriptionLength, 'INVALID_SKILL_DESCRIPTION'),
    triggers: normalizeTriggers(input.triggers),
    allowedTools,
    approvalRequiredTools,
    arguments: normalizeArguments(input.arguments),
    model,
    execution: input.execution,
    prompt: normalizePrompt(input.prompt)
  });
}
