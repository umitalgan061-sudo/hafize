const SOURCES = new Set(['builtin', 'user', 'project']);
const EXECUTIONS = new Set(['inline', 'fork']);
const ARGUMENT_TYPES = new Set(['string', 'number', 'boolean']);
const TOP_FIELDS = new Set(['name', 'description', 'triggers', 'allowedTools', 'arguments', 'model', 'execution', 'prompt', 'projectScope']);
const ARGUMENT_FIELDS = new Set(['name', 'type', 'required', 'description']);
const FORBIDDEN_TOOLS = new Set(['secret.read', 'repo.delete']);

const NAME_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,79}$/;
const PROJECT_SCOPE_PATTERN = /^[a-z][a-z0-9._/-]{0,119}$/;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;
const CREDENTIAL_PATTERN = /(-----BEGIN [A-Z ]*PRIVATE KEY|\b(api[\s_-]?key|secret|password|passphrase|client[\s_-]?secret|access[\s_-]?token|refresh[\s_-]?token|bearer)\b\s*[:=]|\bAuthorization\s*:\s*Bearer\b)/i;

const MAX_DESCRIPTION_LENGTH = 300;
const MAX_TRIGGERS = 12;
const MAX_TRIGGER_LENGTH = 80;
const MAX_ALLOWED_TOOLS = 24;
const MAX_ARGUMENTS = 8;
const MAX_PROMPT_LENGTH = 20_000;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function plainObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }

function safeText(value, maxLength, code) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || CONTROL_PATTERN.test(text)) fail(code);
  return text;
}

function normalizeTriggers(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_TRIGGERS) fail('INVALID_SKILL_TRIGGERS');
  const triggers = new Set();
  for (const item of value) {
    const trigger = safeText(item, MAX_TRIGGER_LENGTH, 'INVALID_SKILL_TRIGGERS').toLowerCase();
    if (triggers.has(trigger)) fail('INVALID_SKILL_TRIGGERS');
    triggers.add(trigger);
  }
  return Object.freeze([...triggers]);
}

function normalizeAllowedTools(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_ALLOWED_TOOLS) fail('INVALID_SKILL_ALLOWED_TOOLS');
  const tools = new Set();
  for (const item of value) {
    const tool = typeof item === 'string' ? item.trim() : '';
    if (!PERMISSION_PATTERN.test(tool) || tools.has(tool)) fail('INVALID_SKILL_ALLOWED_TOOLS');
    if (FORBIDDEN_TOOLS.has(tool)) fail('SKILL_TOOL_FORBIDDEN');
    tools.add(tool);
  }
  return Object.freeze([...tools]);
}

function normalizeArguments(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_ARGUMENTS) fail('INVALID_SKILL_ARGUMENTS');
  const args = [];
  const seen = new Set();
  for (const item of value) {
    if (!plainObject(item)) fail('INVALID_SKILL_ARGUMENTS');
    for (const field of Object.keys(item)) if (!ARGUMENT_FIELDS.has(field)) fail('INVALID_SKILL_ARGUMENT_FIELD');
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!ARGUMENT_NAME_PATTERN.test(name) || seen.has(name)) fail('INVALID_SKILL_ARGUMENTS');
    if (!ARGUMENT_TYPES.has(item.type)) fail('INVALID_SKILL_ARGUMENTS');
    if (item.required != null && typeof item.required !== 'boolean') fail('INVALID_SKILL_ARGUMENTS');
    seen.add(name);
    const description = item.description == null ? '' : safeText(item.description, MAX_DESCRIPTION_LENGTH, 'INVALID_SKILL_ARGUMENTS');
    args.push(Object.freeze({ name, type: item.type, required: item.required === true, description }));
  }
  return Object.freeze(args);
}

function normalizePrompt(value) {
  if (typeof value !== 'string') fail('INVALID_SKILL_PROMPT');
  const prompt = value.trim();
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH || prompt.includes('\0')) fail('INVALID_SKILL_PROMPT');
  if (CREDENTIAL_PATTERN.test(prompt)) fail('SKILL_PROMPT_CREDENTIAL_FORBIDDEN');
  return prompt;
}

function normalizeProjectScope(value, source) {
  if (source !== 'project') {
    if (value != null) fail('INVALID_SKILL_PROJECT_SCOPE');
    return null;
  }
  const scope = typeof value === 'string' ? value.trim() : '';
  if (!PROJECT_SCOPE_PATTERN.test(scope)) fail('INVALID_SKILL_PROJECT_SCOPE');
  return scope;
}

export function normalizeSkillManifest(input = {}, { source } = {}) {
  if (!SOURCES.has(source)) fail('INVALID_SKILL_SOURCE');
  if (!plainObject(input)) fail('INVALID_SKILL_MANIFEST');
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail('INVALID_SKILL_FIELD');

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!NAME_PATTERN.test(name)) fail('INVALID_SKILL_NAME');
  if (!EXECUTIONS.has(input.execution)) fail('INVALID_SKILL_EXECUTION');
  if (input.model != null && !MODEL_PATTERN.test(typeof input.model === 'string' ? input.model.trim() : '')) fail('INVALID_SKILL_MODEL');

  return Object.freeze({
    name,
    source,
    description: safeText(input.description, MAX_DESCRIPTION_LENGTH, 'INVALID_SKILL_DESCRIPTION'),
    triggers: normalizeTriggers(input.triggers),
    allowedTools: normalizeAllowedTools(input.allowedTools),
    arguments: normalizeArguments(input.arguments),
    model: input.model == null ? null : input.model.trim(),
    execution: input.execution,
    prompt: normalizePrompt(input.prompt),
    projectScope: normalizeProjectScope(input.projectScope, source)
  });
}

export const SKILL_SOURCE_PRECEDENCE = Object.freeze(['builtin', 'user', 'project']);
export const SKILL_LIMITS = Object.freeze({
  maxDescriptionLength: MAX_DESCRIPTION_LENGTH, maxTriggers: MAX_TRIGGERS, maxTriggerLength: MAX_TRIGGER_LENGTH,
  maxAllowedTools: MAX_ALLOWED_TOOLS, maxArguments: MAX_ARGUMENTS, maxPromptLength: MAX_PROMPT_LENGTH
});
