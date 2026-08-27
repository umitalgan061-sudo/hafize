const TOP_FIELDS = new Set([
  'id',
  'name',
  'description',
  'triggers',
  'allowedTools',
  'arguments',
  'model',
  'execution',
  'prompt'
]);
const ARGUMENT_FIELDS = new Set(['name', 'type', 'required']);
const EXECUTION_MODES = new Set(['inline', 'fork']);
const ARGUMENT_TYPES = new Set(['string', 'number', 'boolean']);

const ID_PATTERN = /^[a-z][a-z0-9-]{1,47}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const TRIGGER_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,39}$/u;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._/-]{0,79}$/;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;

const NEVER_SKILL_TOOLS = new Set(['secret.read', 'repo.delete']);
const APPROVAL_ONLY_TOOLS = new Set(['external.write', 'external.send', 'repo.merge', 'repo.write_branch']);
const TOOL_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;

const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 400;
const MAX_PROMPT_LENGTH = 8000;
const MAX_TRIGGERS = 12;
const MAX_TOOLS = 12;
const MAX_ARGUMENTS = 8;

const CREDENTIAL_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|password|passwd|bearer)\b\s*[:=]/i
];

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function requireCleanText(value, maxLength, code) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || CONTROL_PATTERN.test(text)) fail(code);
  return text;
}

function rejectCredentialMaterial(text) {
  for (const pattern of CREDENTIAL_PATTERNS) {
    if (pattern.test(text)) fail('SKILL_CREDENTIAL_MATERIAL');
  }
  return text;
}

function normalizeTriggers(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_TRIGGERS) fail('INVALID_SKILL_TRIGGERS');

  const triggers = [];
  const seen = new Set();
  for (const item of value) {
    const trigger = typeof item === 'string' ? item.trim().toLowerCase() : '';
    if (!TRIGGER_PATTERN.test(trigger)) fail('INVALID_SKILL_TRIGGER');
    if (seen.has(trigger)) fail('INVALID_SKILL_TRIGGER');
    seen.add(trigger);
    triggers.push(rejectCredentialMaterial(trigger));
  }
  return Object.freeze(triggers);
}

function normalizeAllowedTools(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_TOOLS) fail('INVALID_SKILL_TOOLS');

  const tools = [];
  const seen = new Set();
  for (const item of value) {
    const tool = typeof item === 'string' ? item.trim() : '';
    if (!TOOL_PATTERN.test(tool)) fail('INVALID_SKILL_TOOL');
    if (seen.has(tool)) fail('INVALID_SKILL_TOOL');
    if (NEVER_SKILL_TOOLS.has(tool) || APPROVAL_ONLY_TOOLS.has(tool)) fail('SKILL_TOOL_ESCALATION');
    seen.add(tool);
    tools.push(tool);
  }
  return Object.freeze(tools);
}

function normalizeArguments(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_ARGUMENTS) fail('INVALID_SKILL_ARGUMENTS');

  const args = [];
  const seen = new Set();
  for (const item of value) {
    if (!item || Array.isArray(item) || typeof item !== 'object') fail('INVALID_SKILL_ARGUMENT');
    for (const field of Object.keys(item)) if (!ARGUMENT_FIELDS.has(field)) fail('INVALID_SKILL_ARGUMENT_FIELD');

    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!ARGUMENT_NAME_PATTERN.test(name) || seen.has(name)) fail('INVALID_SKILL_ARGUMENT');
    if (!ARGUMENT_TYPES.has(item.type)) fail('INVALID_SKILL_ARGUMENT');
    if (item.required != null && typeof item.required !== 'boolean') fail('INVALID_SKILL_ARGUMENT');
    seen.add(name);
    args.push(Object.freeze({ name, type: item.type, required: item.required === true }));
  }
  return Object.freeze(args);
}

function normalizeModel(value) {
  if (value == null) return 'auto';
  const model = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!MODEL_PATTERN.test(model)) fail('INVALID_SKILL_MODEL');
  return model;
}

export function normalizeSkillManifest(input = {}, { source } = {}) {
  if (!SKILL_SOURCES.includes(source)) fail('INVALID_SKILL_SOURCE');
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_SKILL_MANIFEST');
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail('INVALID_SKILL_FIELD');

  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!ID_PATTERN.test(id)) fail('INVALID_SKILL_ID');
  if (!EXECUTION_MODES.has(input.execution)) fail('INVALID_SKILL_EXECUTION');

  return Object.freeze({
    id,
    source,
    name: rejectCredentialMaterial(requireCleanText(input.name, MAX_NAME_LENGTH, 'INVALID_SKILL_NAME')),
    description: rejectCredentialMaterial(
      requireCleanText(input.description, MAX_DESCRIPTION_LENGTH, 'INVALID_SKILL_DESCRIPTION')
    ),
    triggers: normalizeTriggers(input.triggers),
    allowedTools: normalizeAllowedTools(input.allowedTools),
    arguments: normalizeArguments(input.arguments),
    model: normalizeModel(input.model),
    execution: input.execution,
    prompt: rejectCredentialMaterial(requireCleanText(input.prompt, MAX_PROMPT_LENGTH, 'INVALID_SKILL_PROMPT'))
  });
}

export const SKILL_SOURCES = Object.freeze(['builtin', 'user', 'project']);
export const SKILL_EXECUTION_MODES = Object.freeze([...EXECUTION_MODES]);
export const SKILL_LIMITS = Object.freeze({
  maxNameLength: MAX_NAME_LENGTH,
  maxDescriptionLength: MAX_DESCRIPTION_LENGTH,
  maxPromptLength: MAX_PROMPT_LENGTH,
  maxTriggers: MAX_TRIGGERS,
  maxTools: MAX_TOOLS,
  maxArguments: MAX_ARGUMENTS
});
