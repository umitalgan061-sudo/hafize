const SKILL_SOURCES = Object.freeze(['builtin', 'user', 'project']);
const SOURCE_SET = new Set(SKILL_SOURCES);
const EXECUTION_MODES = new Set(['inline', 'fork']);
const TOP_FIELDS = new Set([
  'id', 'name', 'description', 'triggers', 'requestedTools', 'arguments',
  'model', 'execution', 'forkAgentId', 'projectScope', 'prompt'
]);
const ARGUMENT_FIELDS = new Set(['name', 'type', 'required', 'description']);
const ARGUMENT_TYPES = new Set(['string', 'number', 'boolean']);

const ID_PATTERN = /^[a-z][a-z0-9-]{1,48}$/;
const TOOL_PATTERN = /^[a-z][a-z0-9_.]{1,48}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-zA-Z0-9_]{0,32}$/;
const SCOPE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,120}$/;
const MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,80}$/;
const SECRET_NAME_PATTERN = /(secret|token|password|passwd|credential|api[-_]?key|private[-_]?key|authorization|bearer|cookie)/i;
const SECRET_REFERENCE_PATTERN = /(process\s*\.\s*env|\$\{?\s*(env|secret|secrets|credentials?)\b|\{\{\s*(env|secret|secrets|credentials?)\b|<%=?\s*(env|secret|secrets|credentials?)\b)/i;

const MAX_NAME = 80;
const MAX_DESCRIPTION = 400;
const MAX_TRIGGERS = 12;
const MAX_TRIGGER_LENGTH = 60;
const MAX_TOOLS = 16;
const MAX_ARGUMENTS = 8;
const MAX_ARGUMENT_DESCRIPTION = 200;
const MAX_ARGUMENT_VALUE = 2000;
const MAX_PROMPT = 8000;

function fail(field) {
  const error = new Error(`INVALID_SKILL_MANIFEST:${field}`);
  error.code = 'INVALID_SKILL_MANIFEST';
  error.field = field;
  throw error;
}

function cleanText(value, field, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || /[\0\r]/.test(text)) fail(field);
  return text;
}

function normalizeTriggers(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_TRIGGERS) fail('triggers');
  const triggers = [];
  const seen = new Set();
  for (const item of value) {
    const trigger = cleanText(item, 'triggers', MAX_TRIGGER_LENGTH).toLowerCase();
    if (seen.has(trigger)) fail('triggers.duplicate');
    seen.add(trigger);
    triggers.push(trigger);
  }
  return Object.freeze(triggers);
}

function normalizeRequestedTools(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_TOOLS) fail('requestedTools');
  const tools = [];
  const seen = new Set();
  for (const item of value) {
    const tool = typeof item === 'string' ? item.trim() : '';
    if (!TOOL_PATTERN.test(tool)) fail('requestedTools.entry');
    if (seen.has(tool)) fail('requestedTools.duplicate');
    seen.add(tool);
    tools.push(tool);
  }
  return Object.freeze(tools);
}

function normalizeArgument(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') fail('arguments.entry');
  for (const key of Object.keys(value)) if (!ARGUMENT_FIELDS.has(key)) fail('arguments.field');
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!ARGUMENT_NAME_PATTERN.test(name)) fail('arguments.name');
  if (SECRET_NAME_PATTERN.test(name)) fail('arguments.secretName');
  const type = typeof value.type === 'string' ? value.type.trim() : '';
  if (!ARGUMENT_TYPES.has(type)) fail('arguments.type');
  if (value.required !== undefined && typeof value.required !== 'boolean') fail('arguments.required');
  const description = value.description == null
    ? null
    : cleanText(value.description, 'arguments.description', MAX_ARGUMENT_DESCRIPTION);
  return Object.freeze({ name, type, required: value.required === true, description });
}

function normalizeArguments(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_ARGUMENTS) fail('arguments');
  const args = value.map(normalizeArgument);
  if (new Set(args.map((arg) => arg.name)).size !== args.length) fail('arguments.duplicate');
  return Object.freeze(args);
}

function normalizePrompt(value) {
  const prompt = typeof value === 'string' ? value.trim() : '';
  if (!prompt || prompt.length > MAX_PROMPT || prompt.includes('\0')) fail('prompt');
  if (SECRET_REFERENCE_PATTERN.test(prompt)) fail('prompt.secretReference');
  return prompt;
}

export function normalizeSkillManifest(input = {}, { source } = {}) {
  if (!SOURCE_SET.has(source)) fail('source');
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('manifest');
  for (const key of Object.keys(input)) if (!TOP_FIELDS.has(key)) fail('field');

  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!ID_PATTERN.test(id)) fail('id');

  const execution = typeof input.execution === 'string' ? input.execution.trim() : '';
  if (!EXECUTION_MODES.has(execution)) fail('execution');

  let forkAgentId = null;
  if (execution === 'fork') {
    forkAgentId = cleanText(input.forkAgentId, 'forkAgentId', 64);
    if (!/^[a-z][a-z0-9-]{1,63}$/.test(forkAgentId)) fail('forkAgentId');
  } else if (input.forkAgentId !== undefined) {
    fail('forkAgentId.inline');
  }

  let projectScope = null;
  if (source === 'project') {
    projectScope = cleanText(input.projectScope, 'projectScope', 120);
    if (!SCOPE_PATTERN.test(projectScope)) fail('projectScope');
  } else if (input.projectScope !== undefined) {
    fail('projectScope.source');
  }

  let model = null;
  if (input.model !== undefined) {
    model = cleanText(input.model, 'model', 80);
    if (!MODEL_PATTERN.test(model)) fail('model');
  }

  return Object.freeze({
    id,
    source,
    name: cleanText(input.name, 'name', MAX_NAME),
    description: cleanText(input.description, 'description', MAX_DESCRIPTION),
    triggers: normalizeTriggers(input.triggers),
    requestedTools: normalizeRequestedTools(input.requestedTools),
    arguments: normalizeArguments(input.arguments),
    model,
    execution,
    forkAgentId,
    projectScope,
    prompt: normalizePrompt(input.prompt)
  });
}

export function normalizeSkillArguments(manifest, input = {}) {
  if (!manifest || !Array.isArray(manifest.arguments)) fail('manifest');
  if (input == null) input = {};
  if (Array.isArray(input) || typeof input !== 'object') fail('arguments.input');

  const declared = new Map(manifest.arguments.map((arg) => [arg.name, arg]));
  for (const key of Object.keys(input)) if (!declared.has(key)) fail('arguments.unknown');

  const normalized = {};
  for (const arg of manifest.arguments) {
    const value = input[arg.name];
    if (value === undefined || value === null) {
      if (arg.required) fail('arguments.missing');
      continue;
    }
    if (arg.type === 'string') {
      const text = typeof value === 'string' ? value.trim() : '';
      if (!text || text.length > MAX_ARGUMENT_VALUE || text.includes('\0')) fail('arguments.value');
      normalized[arg.name] = text;
    } else if (arg.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) fail('arguments.value');
      normalized[arg.name] = value;
    } else {
      if (typeof value !== 'boolean') fail('arguments.value');
      normalized[arg.name] = value;
    }
  }
  return Object.freeze(normalized);
}

export const SKILL_MANIFEST_LIMITS = Object.freeze({
  sources: SKILL_SOURCES,
  maxTriggers: MAX_TRIGGERS,
  maxRequestedTools: MAX_TOOLS,
  maxArguments: MAX_ARGUMENTS,
  maxArgumentValueLength: MAX_ARGUMENT_VALUE,
  maxPromptLength: MAX_PROMPT
});
