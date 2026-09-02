const TOP_FIELDS = new Set(['name', 'description', 'triggers', 'tools', 'arguments', 'model', 'execution', 'prompt']);
const ARGUMENT_FIELDS = new Set(['name', 'type', 'required', 'description']);
const NAME_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const TRIGGER_PATTERN = /^[\p{Ll}\p{N}][\p{Ll}\p{N}\p{M} ._-]{0,63}$/u;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._\/-]{0,119}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;
const ARGUMENT_TYPES = new Set(['string', 'number', 'boolean']);
const EXECUTION_MODES = new Set(['inline', 'fork']);
const FORBIDDEN_TOOLS = new Set(['secret.read', 'repo.delete']);
const SECRET_PATTERNS = [
  /process\.env/i,
  /\bbearer\s+[a-z0-9._-]{8,}/i,
  /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key)\b\s*[:=]/i,
  /\bsk-[a-z0-9]{16,}/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/
];
const SOURCES = Object.freeze(['builtin', 'user', 'project']);
const LIMITS = Object.freeze({
  maxDescriptionLength: 300,
  maxTriggers: 10,
  maxTools: 20,
  maxArguments: 10,
  maxPromptLength: 20_000
});

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function plainObject(value) {
  return Boolean(value) && !Array.isArray(value) && typeof value === 'object';
}

function normalizeName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!NAME_PATTERN.test(name)) fail('INVALID_SKILL_NAME');
  return name;
}

function normalizeDescription(value) {
  const description = typeof value === 'string' ? value.trim() : '';
  if (!description || description.length > LIMITS.maxDescriptionLength || /[\r\n\0]/.test(description)) {
    fail('INVALID_SKILL_DESCRIPTION');
  }
  return description;
}

function normalizeList(value, { label, pattern, max, lowercase = false }) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > max) fail(label);

  const items = [];
  const seen = new Set();
  for (const entry of value) {
    const raw = typeof entry === 'string' ? entry.trim() : '';
    const item = lowercase ? raw.toLowerCase() : raw;
    if (!pattern.test(item) || seen.has(item)) fail(label);
    seen.add(item);
    items.push(item);
  }
  return Object.freeze(items);
}

function normalizeTools(value) {
  const tools = normalizeList(value, { label: 'INVALID_SKILL_TOOLS', pattern: PERMISSION_PATTERN, max: LIMITS.maxTools });
  for (const tool of tools) if (FORBIDDEN_TOOLS.has(tool)) fail(`SKILL_TOOL_FORBIDDEN:${tool}`);
  return tools;
}

function normalizeArguments(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > LIMITS.maxArguments) fail('INVALID_SKILL_ARGUMENTS');

  const args = [];
  const seen = new Set();
  for (const entry of value) {
    if (!plainObject(entry)) fail('INVALID_SKILL_ARGUMENTS');
    for (const field of Object.keys(entry)) if (!ARGUMENT_FIELDS.has(field)) fail('INVALID_SKILL_ARGUMENT_FIELD');
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!ARGUMENT_NAME_PATTERN.test(name) || seen.has(name)) fail('INVALID_SKILL_ARGUMENT_NAME');
    seen.add(name);

    const type = entry.type == null ? 'string' : entry.type;
    if (typeof type !== 'string' || !ARGUMENT_TYPES.has(type)) fail('INVALID_SKILL_ARGUMENT_TYPE');
    if (entry.required != null && typeof entry.required !== 'boolean') fail('INVALID_SKILL_ARGUMENT_REQUIRED');

    const argument = { name, type, required: entry.required === true };
    if (entry.description != null) argument.description = normalizeDescription(entry.description);
    args.push(Object.freeze(argument));
  }
  return Object.freeze(args);
}

function normalizeModel(value) {
  if (value == null) return null;
  const model = typeof value === 'string' ? value.trim() : '';
  if (!MODEL_PATTERN.test(model)) fail('INVALID_SKILL_MODEL');
  return model;
}

function normalizeExecution(value) {
  const execution = value == null ? 'inline' : value;
  if (typeof execution !== 'string' || !EXECUTION_MODES.has(execution)) fail('INVALID_SKILL_EXECUTION');
  return execution;
}

function normalizePrompt(value) {
  if (typeof value !== 'string') fail('INVALID_SKILL_PROMPT');
  const prompt = value.trim();
  if (!prompt || prompt.length > LIMITS.maxPromptLength || prompt.includes('\0')) fail('INVALID_SKILL_PROMPT');
  for (const pattern of SECRET_PATTERNS) if (pattern.test(prompt)) fail('SKILL_PROMPT_SECRET');
  return prompt;
}

export function normalizeSkillManifest(input = {}, { source } = {}) {
  if (!plainObject(input)) fail('INVALID_SKILL_MANIFEST');
  if (!SOURCES.includes(source)) fail('INVALID_SKILL_SOURCE');
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail('INVALID_SKILL_FIELD');

  return Object.freeze({
    name: normalizeName(input.name),
    source,
    description: normalizeDescription(input.description),
    triggers: normalizeList(input.triggers, { label: 'INVALID_SKILL_TRIGGERS', pattern: TRIGGER_PATTERN, max: LIMITS.maxTriggers, lowercase: true }),
    tools: normalizeTools(input.tools),
    arguments: normalizeArguments(input.arguments),
    model: normalizeModel(input.model),
    execution: normalizeExecution(input.execution),
    prompt: normalizePrompt(input.prompt)
  });
}

export const SKILL_SOURCES = SOURCES;
export const SKILL_EXECUTION_MODES = Object.freeze([...EXECUTION_MODES]);
export const SKILL_MANIFEST_LIMITS = LIMITS;
