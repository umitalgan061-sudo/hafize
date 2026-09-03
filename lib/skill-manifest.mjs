const TOP_FIELDS = new Set([
  'name',
  'description',
  'source',
  'execution',
  'triggers',
  'allowedTools',
  'arguments',
  'model',
  'projectScope',
  'prompt'
]);
const ARGUMENT_FIELDS = new Set(['name', 'description', 'required']);
const SOURCES = new Set(['builtin', 'user', 'project']);
const EXECUTIONS = new Set(['inline', 'fork']);

const NAME_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const TOOL_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const ARGUMENT_PATTERN = /^[a-z][a-zA-Z0-9_]{0,39}$/;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._/-]{0,119}$/;
const SCOPE_PATTERN = /^[a-z][a-z0-9_.:\/-]{2,119}$/;
const PLACEHOLDER_PATTERN = /\{\{\s*([^{}]*?)\s*\}\}/g;
const SECRET_NAME_PATTERN = /(secret|token|password|passwd|credential|api_?key|private_?key|access_?key|authorization|cookie|session_?id)/i;
const SECRET_PROMPT_PATTERN = /(process\.env|\$\{?env[._]|\{\{\s*(env|secret|token|credential))/i;
const FORBIDDEN_TOOLS = new Set(['secret.read', 'repo.delete']);

const LIMITS = Object.freeze({
  maxDescriptionLength: 400,
  maxTriggers: 12,
  maxTriggerLength: 120,
  maxTools: 16,
  maxArguments: 8,
  maxPromptLength: 20_000,
  maxArgumentValueLength: 4_000
});

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function requireText(value, code, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || /[\0]/.test(text)) fail(code);
  return text;
}

function normalizeTriggers(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > LIMITS.maxTriggers) fail('INVALID_SKILL_TRIGGERS');
  const triggers = [];
  const seen = new Set();
  for (const item of value) {
    const trigger = requireText(item, 'INVALID_SKILL_TRIGGER', LIMITS.maxTriggerLength).toLowerCase();
    if (seen.has(trigger)) fail('INVALID_SKILL_TRIGGER');
    seen.add(trigger);
    triggers.push(trigger);
  }
  return Object.freeze(triggers);
}

function normalizeTools(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > LIMITS.maxTools) fail('INVALID_SKILL_TOOLS');
  const tools = [];
  const seen = new Set();
  for (const item of value) {
    const tool = typeof item === 'string' ? item.trim() : '';
    if (!TOOL_PATTERN.test(tool)) fail('INVALID_SKILL_TOOL');
    if (FORBIDDEN_TOOLS.has(tool)) fail('SKILL_TOOL_FORBIDDEN');
    if (seen.has(tool)) fail('INVALID_SKILL_TOOL');
    seen.add(tool);
    tools.push(tool);
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
    for (const field of Object.keys(item)) if (!ARGUMENT_FIELDS.has(field)) fail('INVALID_SKILL_ARGUMENT_FIELD');
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!ARGUMENT_PATTERN.test(name)) fail('INVALID_SKILL_ARGUMENT');
    if (SECRET_NAME_PATTERN.test(name)) fail('SKILL_ARGUMENT_SECRET_FORBIDDEN');
    if (seen.has(name)) fail('INVALID_SKILL_ARGUMENT');
    if (item.required != null && typeof item.required !== 'boolean') fail('INVALID_SKILL_ARGUMENT');
    seen.add(name);
    args.push(
      Object.freeze({
        name,
        required: item.required === true,
        description: item.description == null ? '' : requireText(item.description, 'INVALID_SKILL_ARGUMENT', LIMITS.maxDescriptionLength)
      })
    );
  }
  return Object.freeze(args);
}

function normalizePrompt(value, args) {
  const prompt = requireText(value, 'INVALID_SKILL_PROMPT', LIMITS.maxPromptLength);
  if (SECRET_PROMPT_PATTERN.test(prompt)) fail('SKILL_PROMPT_SECRET_FORBIDDEN');
  const declared = new Set(args.map((item) => item.name));
  for (const match of prompt.matchAll(PLACEHOLDER_PATTERN)) {
    if (!declared.has(match[1])) fail('INVALID_SKILL_PROMPT_PLACEHOLDER');
  }
  return prompt;
}

export function normalizeSkillManifest(input = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_SKILL_MANIFEST');
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail('INVALID_SKILL_MANIFEST_FIELD');

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!NAME_PATTERN.test(name)) fail('INVALID_SKILL_NAME');
  if (!SOURCES.has(input.source)) fail('INVALID_SKILL_SOURCE');
  if (input.execution != null && !EXECUTIONS.has(input.execution)) fail('INVALID_SKILL_EXECUTION');

  const model = input.model == null ? null : typeof input.model === 'string' ? input.model.trim() : '';
  if (model !== null && !MODEL_PATTERN.test(model)) fail('INVALID_SKILL_MODEL');

  let projectScope = null;
  if (input.source === 'project') {
    projectScope = typeof input.projectScope === 'string' ? input.projectScope.trim() : '';
    if (!SCOPE_PATTERN.test(projectScope)) fail('INVALID_SKILL_PROJECT_SCOPE');
  } else if (input.projectScope != null) {
    fail('INVALID_SKILL_PROJECT_SCOPE');
  }

  const args = normalizeArguments(input.arguments);

  return Object.freeze({
    name,
    description: requireText(input.description, 'INVALID_SKILL_DESCRIPTION', LIMITS.maxDescriptionLength),
    source: input.source,
    execution: input.execution || 'inline',
    triggers: normalizeTriggers(input.triggers),
    allowedTools: normalizeTools(input.allowedTools),
    arguments: args,
    model,
    projectScope,
    prompt: normalizePrompt(input.prompt, args)
  });
}

export const SKILL_MANIFEST_LIMITS = LIMITS;
export const SKILL_PLACEHOLDER_PATTERN = PLACEHOLDER_PATTERN;
export const SKILL_ARGUMENT_SECRET_PATTERN = SECRET_NAME_PATTERN;
