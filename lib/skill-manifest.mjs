const SOURCES = new Set(['builtin', 'user', 'project']);
const EXECUTION_MODES = new Set(['inline', 'fork']);
const TOP_FIELDS = new Set([
  'name',
  'description',
  'prompt',
  'triggers',
  'allowedTools',
  'arguments',
  'model',
  'execution',
  'projectScope'
]);
const ARGUMENT_FIELDS = new Set(['name', 'description', 'required']);

const NAME_PATTERN = /^[a-z][a-z0-9-]{1,47}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._/-]{0,79}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const SCOPE_PATTERN = /^[a-z0-9][a-z0-9._/-]{0,119}$/;

const NEVER_SKILL_PERMISSIONS = new Set(['secret.read', 'repo.delete']);
const APPROVAL_ONLY_PERMISSIONS = new Set(['external.write', 'external.send', 'repo.merge', 'repo.write_branch']);

const SECRET_ASSIGNMENT = /\b(api[-_ ]?key|secret|password|passwd|token|credential|authorization|bearer)\b\s*[:=]\s*\S/i;
const SECRET_PEM = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const SECRET_BEARER = /\bBearer\s+[A-Za-z0-9._-]{8,}/i;

const MAX_DESCRIPTION_LENGTH = 300;
const MAX_PROMPT_LENGTH = 8000;
const MAX_TRIGGERS = 12;
const MAX_TRIGGER_LENGTH = 80;
const MAX_ALLOWED_TOOLS = 12;
const MAX_ARGUMENTS = 8;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function rejectUnknownFields(input, allowed, code) {
  for (const field of Object.keys(input)) if (!allowed.has(field)) fail(code);
}

function plainText(value, maxLength, code) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || /[\0\r]/.test(text)) fail(code);
  return text;
}

function rejectEmbeddedSecret(text, code) {
  if (SECRET_ASSIGNMENT.test(text) || SECRET_PEM.test(text) || SECRET_BEARER.test(text)) fail(code);
  return text;
}

function normalizeTriggers(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_TRIGGERS) fail('INVALID_SKILL_TRIGGERS');
  const triggers = [];
  const seen = new Set();
  for (const item of value) {
    const trigger = plainText(item, MAX_TRIGGER_LENGTH, 'INVALID_SKILL_TRIGGER').toLowerCase();
    if (trigger.length < 2 || seen.has(trigger)) fail('INVALID_SKILL_TRIGGER');
    seen.add(trigger);
    triggers.push(trigger);
  }
  return Object.freeze(triggers);
}

function normalizeAllowedTools(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_ALLOWED_TOOLS) fail('INVALID_SKILL_ALLOWED_TOOLS');
  const permissions = [];
  const seen = new Set();
  for (const item of value) {
    const permission = typeof item === 'string' ? item.trim() : '';
    if (!PERMISSION_PATTERN.test(permission) || seen.has(permission)) fail('INVALID_SKILL_ALLOWED_TOOL');
    if (NEVER_SKILL_PERMISSIONS.has(permission) || APPROVAL_ONLY_PERMISSIONS.has(permission)) {
      fail('SKILL_TOOL_ESCALATION_REJECTED');
    }
    seen.add(permission);
    permissions.push(permission);
  }
  return Object.freeze(permissions);
}

function normalizeArguments(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_ARGUMENTS) fail('INVALID_SKILL_ARGUMENTS');
  const args = [];
  const seen = new Set();
  for (const item of value) {
    if (!item || Array.isArray(item) || typeof item !== 'object') fail('INVALID_SKILL_ARGUMENT');
    rejectUnknownFields(item, ARGUMENT_FIELDS, 'INVALID_SKILL_ARGUMENT_FIELD');
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!ARGUMENT_NAME_PATTERN.test(name) || seen.has(name)) fail('INVALID_SKILL_ARGUMENT');
    if (item.required != null && typeof item.required !== 'boolean') fail('INVALID_SKILL_ARGUMENT');
    const description = item.description == null
      ? null
      : rejectEmbeddedSecret(
        plainText(item.description, MAX_DESCRIPTION_LENGTH, 'INVALID_SKILL_ARGUMENT'),
        'SKILL_SECRET_REJECTED'
      );
    seen.add(name);
    args.push(Object.freeze({ name, description, required: item.required === true }));
  }
  return Object.freeze(args);
}

export function normalizeSkillManifest(input = {}, { source } = {}) {
  if (!SOURCES.has(source)) fail('INVALID_SKILL_SOURCE');
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_SKILL_MANIFEST');
  rejectUnknownFields(input, TOP_FIELDS, 'INVALID_SKILL_FIELD');

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!NAME_PATTERN.test(name)) fail('INVALID_SKILL_NAME');

  const description = rejectEmbeddedSecret(
    plainText(input.description, MAX_DESCRIPTION_LENGTH, 'INVALID_SKILL_DESCRIPTION'),
    'SKILL_SECRET_REJECTED'
  );

  if (typeof input.prompt !== 'string') fail('INVALID_SKILL_PROMPT');
  const prompt = input.prompt.trim();
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH || prompt.includes('\0')) fail('INVALID_SKILL_PROMPT');
  rejectEmbeddedSecret(prompt, 'SKILL_SECRET_REJECTED');

  const execution = typeof input.execution === 'string' ? input.execution.trim() : '';
  if (!EXECUTION_MODES.has(execution)) fail('INVALID_SKILL_EXECUTION');

  let model = null;
  if (input.model != null) {
    const candidate = typeof input.model === 'string' ? input.model.trim() : '';
    if (!MODEL_PATTERN.test(candidate)) fail('INVALID_SKILL_MODEL');
    model = candidate;
  }

  let projectScope = null;
  if (source === 'project') {
    const scope = typeof input.projectScope === 'string' ? input.projectScope.trim() : '';
    if (!SCOPE_PATTERN.test(scope)) fail('INVALID_SKILL_PROJECT_SCOPE');
    projectScope = scope;
  } else if (input.projectScope != null) {
    fail('INVALID_SKILL_PROJECT_SCOPE');
  }

  return Object.freeze({
    name,
    source,
    description,
    prompt,
    execution,
    model,
    projectScope,
    triggers: normalizeTriggers(input.triggers),
    allowedTools: normalizeAllowedTools(input.allowedTools),
    arguments: normalizeArguments(input.arguments)
  });
}

export const SKILL_MANIFEST_LIMITS = Object.freeze({
  maxDescriptionLength: MAX_DESCRIPTION_LENGTH,
  maxPromptLength: MAX_PROMPT_LENGTH,
  maxTriggers: MAX_TRIGGERS,
  maxTriggerLength: MAX_TRIGGER_LENGTH,
  maxAllowedTools: MAX_ALLOWED_TOOLS,
  maxArguments: MAX_ARGUMENTS
});

export const SKILL_SOURCES = Object.freeze(['builtin', 'user', 'project']);
export const SKILL_EXECUTION_MODES = Object.freeze(['inline', 'fork']);
