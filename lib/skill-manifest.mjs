const TOP_FIELDS = new Set([
  'name', 'description', 'triggers', 'arguments', 'allowedTools', 'model', 'execution', 'source', 'project', 'prompt'
]);
const ARGUMENT_FIELDS = new Set(['name', 'type', 'required', 'description']);
const NAME_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const TOOL_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._:/-]{0,79}$/;
const PROJECT_PATTERN = /^[a-z0-9][a-z0-9._/-]{0,119}$/;
const ARGUMENT_TYPES = new Set(['string', 'number', 'boolean']);
const EXECUTION_MODES = new Set(['inline', 'fork']);
const SOURCES = new Set(['builtin', 'user', 'project']);
const FORBIDDEN_TOOLS = new Set([
  'secret.read', 'repo.delete', 'repo.merge', 'repo.write_branch', 'external.write', 'external.send'
]);
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9]{16,}/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bAKIA[0-9A-Z]{12,}/,
  /\b(api[-_]?key|access[-_]?token|client[-_]?secret|password)\s*[:=]\s*\S{6,}/i
];

const MAX_DESCRIPTION_LENGTH = 400;
const MAX_TRIGGERS = 12;
const MAX_TRIGGER_LENGTH = 80;
const MAX_ARGUMENTS = 8;
const MAX_ALLOWED_TOOLS = 16;
const MAX_PROMPT_LENGTH = 20_000;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function rejectUnknownFields(input, fields, code) {
  for (const field of Object.keys(input)) if (!fields.has(field)) fail(code);
}

function normalizeName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!NAME_PATTERN.test(name)) fail('INVALID_SKILL_NAME');
  return name;
}

function normalizeDescription(value) {
  const description = typeof value === 'string' ? value.trim() : '';
  if (!description || description.length > MAX_DESCRIPTION_LENGTH || /[\0\r]/.test(description)) {
    fail('INVALID_SKILL_DESCRIPTION');
  }
  return description;
}

function normalizeTriggers(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_TRIGGERS) fail('INVALID_SKILL_TRIGGERS');
  const triggers = [];
  const seen = new Set();
  for (const item of value) {
    const trigger = typeof item === 'string' ? item.trim().toLowerCase() : '';
    if (!trigger || trigger.length > MAX_TRIGGER_LENGTH || /[\0\r\n]/.test(trigger)) fail('INVALID_SKILL_TRIGGER');
    if (seen.has(trigger)) fail('INVALID_SKILL_TRIGGER');
    seen.add(trigger);
    triggers.push(trigger);
  }
  return Object.freeze(triggers);
}

function normalizeArgument(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') fail('INVALID_SKILL_ARGUMENT');
  rejectUnknownFields(value, ARGUMENT_FIELDS, 'INVALID_SKILL_ARGUMENT_FIELD');
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!NAME_PATTERN.test(name)) fail('INVALID_SKILL_ARGUMENT');
  if (!ARGUMENT_TYPES.has(value.type)) fail('INVALID_SKILL_ARGUMENT');
  if (typeof value.required !== 'boolean') fail('INVALID_SKILL_ARGUMENT');
  const description = value.description === undefined ? null : normalizeDescription(value.description);
  return Object.freeze({ name, type: value.type, required: value.required, description });
}

function normalizeArguments(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_ARGUMENTS) fail('INVALID_SKILL_ARGUMENTS');
  const args = [];
  const seen = new Set();
  for (const item of value) {
    const argument = normalizeArgument(item);
    if (seen.has(argument.name)) fail('INVALID_SKILL_ARGUMENT');
    seen.add(argument.name);
    args.push(argument);
  }
  return Object.freeze(args);
}

function normalizeAllowedTools(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_ALLOWED_TOOLS) fail('INVALID_SKILL_ALLOWED_TOOLS');
  const tools = [];
  const seen = new Set();
  for (const item of value) {
    const tool = typeof item === 'string' ? item.trim() : '';
    if (!TOOL_PATTERN.test(tool) || seen.has(tool)) fail('INVALID_SKILL_ALLOWED_TOOL');
    if (FORBIDDEN_TOOLS.has(tool)) fail('SKILL_TOOL_ESCALATION_FORBIDDEN');
    seen.add(tool);
    tools.push(tool);
  }
  return Object.freeze(tools);
}

function normalizeModel(value) {
  if (value === undefined) return null;
  const model = typeof value === 'string' ? value.trim() : '';
  if (!MODEL_PATTERN.test(model)) fail('INVALID_SKILL_MODEL');
  return model;
}

function normalizeProject(value, source) {
  if (source !== 'project') {
    if (value !== undefined) fail('INVALID_SKILL_PROJECT');
    return null;
  }
  const project = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!PROJECT_PATTERN.test(project)) fail('INVALID_SKILL_PROJECT');
  return project;
}

function normalizePrompt(value) {
  if (typeof value !== 'string') fail('INVALID_SKILL_PROMPT');
  const prompt = value.trim();
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH || prompt.includes('\0')) fail('INVALID_SKILL_PROMPT');
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(prompt)) fail('SKILL_PROMPT_SECRET_FORBIDDEN');
  }
  return prompt;
}

export function normalizeSkillManifest(input = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_SKILL_MANIFEST');
  rejectUnknownFields(input, TOP_FIELDS, 'INVALID_SKILL_MANIFEST_FIELD');
  if (!EXECUTION_MODES.has(input.execution)) fail('INVALID_SKILL_EXECUTION');
  if (!SOURCES.has(input.source)) fail('INVALID_SKILL_SOURCE');

  return Object.freeze({
    name: normalizeName(input.name),
    description: normalizeDescription(input.description),
    triggers: normalizeTriggers(input.triggers),
    arguments: normalizeArguments(input.arguments),
    allowedTools: normalizeAllowedTools(input.allowedTools),
    model: normalizeModel(input.model),
    execution: input.execution,
    source: input.source,
    project: normalizeProject(input.project, input.source),
    prompt: normalizePrompt(input.prompt)
  });
}

export const SKILL_SOURCE_PRIORITY = Object.freeze({ builtin: 1, user: 2, project: 3 });

export const SKILL_MANIFEST_LIMITS = Object.freeze({
  maxDescriptionLength: MAX_DESCRIPTION_LENGTH,
  maxTriggers: MAX_TRIGGERS,
  maxTriggerLength: MAX_TRIGGER_LENGTH,
  maxArguments: MAX_ARGUMENTS,
  maxAllowedTools: MAX_ALLOWED_TOOLS,
  maxPromptLength: MAX_PROMPT_LENGTH
});
