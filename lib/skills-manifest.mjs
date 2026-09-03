const SOURCES = new Set(['builtin', 'user', 'project']);
const EXECUTIONS = new Set(['inline', 'fork']);
const FIELDS = new Set(['name', 'description', 'triggers', 'allowedTools', 'arguments', 'model', 'execution', 'prompt']);
const ARGUMENT_FIELDS = new Set(['name', 'required', 'description']);

const NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const TOOL_PATTERN = /^[a-z][a-z0-9]*(?:[._][a-z0-9]+)*$/;
const ARGUMENT_PATTERN = /^[a-z][a-z0-9_]*$/;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._/-]*$/;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:sk|nvapi|ghp|gho|ghs|ghu|xoxb|xoxp)[-_][A-Za-z0-9_-]{8,}/i,
  /\bAIza[0-9A-Za-z_-]{10,}/,
  /\b(?:api[ _-]?key|secret|password|token|credential)s?\s*[:=]\s*\S/i,
  /\bBearer\s+[A-Za-z0-9._-]{8,}/i,
  /\bprocess\.env\.[A-Z0-9_]+/,
  /\$\{?[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)\}?/
];

const LIMITS = Object.freeze({
  maxNameLength: 48, maxDescriptionLength: 400, maxTriggers: 12,
  maxTriggerLength: 80, maxTools: 12, maxArguments: 8, maxPromptLength: 8000
});

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertNoSecret(value, code) {
  for (const pattern of SECRET_PATTERNS) if (pattern.test(value)) fail(code);
}

function normalizeName(value) {
  const name = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (name.length < 2 || name.length > LIMITS.maxNameLength || !NAME_PATTERN.test(name)) fail('INVALID_SKILL_NAME');
  return name;
}

function normalizeDescription(value) {
  const description = typeof value === 'string' ? value.trim() : '';
  if (!description || description.length > LIMITS.maxDescriptionLength || CONTROL_PATTERN.test(description)) {
    fail('INVALID_SKILL_DESCRIPTION');
  }
  return description;
}

function normalizeTriggers(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > LIMITS.maxTriggers) fail('INVALID_SKILL_TRIGGERS');
  const triggers = new Set();
  for (const item of value) {
    const trigger = typeof item === 'string' ? item.trim().toLowerCase() : '';
    if (!trigger || trigger.length > LIMITS.maxTriggerLength || CONTROL_PATTERN.test(trigger)) fail('INVALID_SKILL_TRIGGER');
    triggers.add(trigger);
  }
  return Object.freeze([...triggers]);
}

function normalizeTools(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > LIMITS.maxTools) fail('INVALID_SKILL_TOOLS');
  const tools = new Set();
  for (const item of value) {
    const tool = typeof item === 'string' ? item.trim() : '';
    if (!tool || tool.length > 64 || !TOOL_PATTERN.test(tool)) fail('INVALID_SKILL_TOOL');
    tools.add(tool);
  }
  return Object.freeze([...tools]);
}

function normalizeArguments(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > LIMITS.maxArguments) fail('INVALID_SKILL_ARGUMENTS');
  const args = [];
  const seen = new Set();
  for (const item of value) {
    if (!plainObject(item)) fail('INVALID_SKILL_ARGUMENT');
    for (const field of Object.keys(item)) if (!ARGUMENT_FIELDS.has(field)) fail('INVALID_SKILL_ARGUMENT_FIELD');
    const name = typeof item.name === 'string' ? item.name.trim().toLowerCase() : '';
    if (!name || name.length > 32 || !ARGUMENT_PATTERN.test(name) || seen.has(name)) fail('INVALID_SKILL_ARGUMENT');
    if (item.required !== undefined && typeof item.required !== 'boolean') fail('INVALID_SKILL_ARGUMENT');
    seen.add(name);
    args.push(Object.freeze({
      name,
      required: item.required === true,
      description: item.description === undefined ? '' : normalizeDescription(item.description)
    }));
  }
  return Object.freeze(args);
}

function normalizeModel(value, source) {
  if (value === undefined || value === null) return null;
  if (source === 'project') fail('SKILL_PROJECT_MODEL_FORBIDDEN');
  const model = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!model || model.length > 64 || !MODEL_PATTERN.test(model)) fail('INVALID_SKILL_MODEL');
  return model;
}

function normalizeExecution(value, source) {
  const execution = value === undefined ? 'inline' : value;
  if (typeof execution !== 'string' || !EXECUTIONS.has(execution)) fail('INVALID_SKILL_EXECUTION');
  if (execution === 'fork' && source === 'project') fail('SKILL_PROJECT_FORK_FORBIDDEN');
  return execution;
}

function normalizePrompt(value) {
  if (typeof value !== 'string') fail('INVALID_SKILL_PROMPT');
  const prompt = value.trim();
  if (!prompt || prompt.length > LIMITS.maxPromptLength || prompt.includes('\0')) fail('INVALID_SKILL_PROMPT');
  assertNoSecret(prompt, 'SKILL_PROMPT_SECRET_FORBIDDEN');
  return prompt;
}

export function normalizeSkillManifest(input = {}, { source } = {}) {
  if (!SOURCES.has(source)) fail('INVALID_SKILL_SOURCE');
  if (!plainObject(input)) fail('INVALID_SKILL_MANIFEST');
  for (const field of Object.keys(input)) if (!FIELDS.has(field)) fail('INVALID_SKILL_FIELD');

  const description = normalizeDescription(input.description);
  assertNoSecret(description, 'SKILL_PROMPT_SECRET_FORBIDDEN');

  return Object.freeze({
    name: normalizeName(input.name),
    description,
    source,
    execution: normalizeExecution(input.execution, source),
    triggers: normalizeTriggers(input.triggers),
    allowedTools: normalizeTools(input.allowedTools),
    arguments: normalizeArguments(input.arguments),
    model: normalizeModel(input.model, source),
    prompt: normalizePrompt(input.prompt)
  });
}

export const SKILL_MANIFEST_LIMITS = LIMITS;
export const SKILL_SOURCES = Object.freeze(['builtin', 'user', 'project']);
export const SKILL_EXECUTIONS = Object.freeze(['inline', 'fork']);
