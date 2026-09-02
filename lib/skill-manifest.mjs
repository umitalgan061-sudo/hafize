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
const SOURCES = new Set(['builtin', 'user', 'project']);
const EXECUTION_MODES = new Set(['inline', 'fork']);
const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._/-]{1,120}$/i;
const ARGUMENT_PATTERN = /^[a-z][a-zA-Z0-9_]{0,39}$/;
const SECRET_PATTERN =
  /(api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|password|passwd|bearer\s+[a-z0-9._-]{8}|private[_-]?key|begin [a-z ]*private key)/i;

const FORBIDDEN_SKILL_PERMISSIONS = new Set([
  'secret.read',
  'repo.delete',
  'external.write',
  'external.send',
  'repo.merge',
  'repo.write_branch'
]);

const LIMITS = Object.freeze({
  maxNameLength: 80,
  maxDescriptionLength: 500,
  maxTriggers: 12,
  maxTriggerLength: 80,
  maxAllowedTools: 12,
  maxArguments: 8,
  maxPromptLength: 20_000
});

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function requireCleanText(value, maxLength, code) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || /[\0\r]/.test(text)) fail(code);
  return text;
}

function normalizeTriggers(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > LIMITS.maxTriggers) fail('INVALID_SKILL_TRIGGERS');
  const triggers = [];
  const seen = new Set();
  for (const item of value) {
    const trigger = requireCleanText(item, LIMITS.maxTriggerLength, 'INVALID_SKILL_TRIGGER').toLowerCase();
    if (/\n/.test(trigger) || seen.has(trigger)) fail('INVALID_SKILL_TRIGGER');
    seen.add(trigger);
    triggers.push(trigger);
  }
  return Object.freeze(triggers);
}

function normalizeAllowedTools(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > LIMITS.maxAllowedTools) fail('INVALID_SKILL_TOOLS');
  const tools = [];
  const seen = new Set();
  for (const item of value) {
    const permission = typeof item === 'string' ? item.trim() : '';
    if (!PERMISSION_PATTERN.test(permission) || seen.has(permission)) fail('INVALID_SKILL_TOOL');
    if (FORBIDDEN_SKILL_PERMISSIONS.has(permission)) fail('SKILL_TOOL_FORBIDDEN');
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
    for (const field of Object.keys(item)) {
      if (!['name', 'description', 'required'].includes(field)) fail('INVALID_SKILL_ARGUMENT');
    }
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!ARGUMENT_PATTERN.test(name) || seen.has(name)) fail('INVALID_SKILL_ARGUMENT');
    if (item.required != null && typeof item.required !== 'boolean') fail('INVALID_SKILL_ARGUMENT');
    seen.add(name);
    args.push(
      Object.freeze({
        name,
        description: requireCleanText(item.description, LIMITS.maxDescriptionLength, 'INVALID_SKILL_ARGUMENT'),
        required: item.required === true
      })
    );
  }
  return Object.freeze(args);
}

function normalizeModel(value) {
  if (value == null) return null;
  const model = typeof value === 'string' ? value.trim() : '';
  if (!MODEL_PATTERN.test(model)) fail('INVALID_SKILL_MODEL');
  return model;
}

function normalizePrompt(value) {
  if (typeof value !== 'string') fail('INVALID_SKILL_PROMPT');
  const prompt = value.trim();
  if (!prompt || prompt.length > LIMITS.maxPromptLength || prompt.includes('\0')) fail('INVALID_SKILL_PROMPT');
  if (SECRET_PATTERN.test(prompt)) fail('SKILL_PROMPT_SECRET_FORBIDDEN');
  return prompt;
}

export function normalizeSkillManifest(input = {}, { source } = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_SKILL_MANIFEST');
  if (!SOURCES.has(source)) fail('INVALID_SKILL_SOURCE');
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail('INVALID_SKILL_FIELD');

  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!ID_PATTERN.test(id)) fail('INVALID_SKILL_ID');

  const execution = typeof input.execution === 'string' ? input.execution.trim() : 'inline';
  if (!EXECUTION_MODES.has(execution)) fail('INVALID_SKILL_EXECUTION');

  return Object.freeze({
    id,
    source,
    name: requireCleanText(input.name, LIMITS.maxNameLength, 'INVALID_SKILL_NAME'),
    description: requireCleanText(input.description, LIMITS.maxDescriptionLength, 'INVALID_SKILL_DESCRIPTION'),
    triggers: normalizeTriggers(input.triggers),
    allowedTools: normalizeAllowedTools(input.allowedTools),
    arguments: normalizeArguments(input.arguments),
    model: normalizeModel(input.model),
    execution,
    prompt: normalizePrompt(input.prompt)
  });
}

export const SKILL_MANIFEST_LIMITS = LIMITS;
export const SKILL_SOURCES = Object.freeze([...SOURCES]);
export const SKILL_EXECUTION_MODES = Object.freeze([...EXECUTION_MODES]);
export const SKILL_FORBIDDEN_PERMISSIONS = Object.freeze([...FORBIDDEN_SKILL_PERMISSIONS]);
