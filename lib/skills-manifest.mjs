const SOURCES = Object.freeze(['builtin', 'user', 'project']);
const EXECUTION_MODES = Object.freeze(['inline', 'fork']);
const TOP_FIELDS = new Set([
  'id',
  'name',
  'description',
  'triggers',
  'allowedTools',
  'arguments',
  'model',
  'execution',
  'prompt',
  'projectScope'
]);
const ARGUMENT_FIELDS = new Set(['name', 'type', 'required', 'description']);
const ARGUMENT_TYPES = new Set(['string', 'number', 'boolean']);

const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\/-]{0,99}$/;
const PROJECT_SCOPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\/-]{0,119}$/;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;
const PROMPT_CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const NEVER_SKILL_TOOLS = new Set(['secret.read', 'repo.delete']);
const APPROVAL_ONLY_TOOLS = new Set(['external.write', 'external.send', 'repo.merge', 'repo.write_branch']);

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bprocess\.env\b/,
  /\b[A-Z][A-Z0-9]*_(?:API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|CREDENTIALS)\b/,
  /\bauthorization\s*:\s*(?:bearer|basic)\s+\S/i,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bnvapi-[A-Za-z0-9_-]{16,}/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/,
  /\bAKIA[0-9A-Z]{16}\b/
];

const LIMITS = Object.freeze({
  maxNameLength: 80,
  maxDescriptionLength: 400,
  maxTriggers: 12,
  maxTriggerLength: 60,
  maxAllowedTools: 16,
  maxArguments: 8,
  maxArgumentDescriptionLength: 200,
  maxPromptLength: 20_000
});

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function requireText(value, code, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || CONTROL_PATTERN.test(text)) fail(code);
  return text;
}

function rejectSecrets(value, code) {
  for (const pattern of SECRET_PATTERNS) if (pattern.test(value)) fail(code);
}

function normalizeSource(value) {
  if (!SOURCES.includes(value)) fail('INVALID_SKILL_SOURCE');
  return value;
}

function normalizeTriggers(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > LIMITS.maxTriggers) fail('INVALID_SKILL_TRIGGERS');
  const triggers = [];
  const seen = new Set();
  for (const item of value) {
    const trigger = requireText(item, 'INVALID_SKILL_TRIGGER', LIMITS.maxTriggerLength).toLowerCase();
    if (trigger.length < 2 || seen.has(trigger)) fail('INVALID_SKILL_TRIGGER');
    seen.add(trigger);
    triggers.push(trigger);
  }
  return Object.freeze(triggers);
}

function normalizeAllowedTools(value, agentAllowedTools) {
  if (!Array.isArray(value) || value.length > LIMITS.maxAllowedTools) fail('INVALID_SKILL_ALLOWED_TOOLS');

  const granted = new Set();
  for (const item of Array.isArray(agentAllowedTools) ? agentAllowedTools : []) {
    if (typeof item === 'string' && PERMISSION_PATTERN.test(item.trim())) granted.add(item.trim());
  }

  const tools = [];
  const seen = new Set();
  for (const item of value) {
    const tool = typeof item === 'string' ? item.trim() : '';
    if (!PERMISSION_PATTERN.test(tool) || seen.has(tool)) fail('INVALID_SKILL_ALLOWED_TOOL');
    if (NEVER_SKILL_TOOLS.has(tool) || APPROVAL_ONLY_TOOLS.has(tool)) fail('SKILL_TOOL_FORBIDDEN');
    if (!granted.has(tool)) fail('SKILL_TOOL_ESCALATION');
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
    if (!ARGUMENT_NAME_PATTERN.test(name) || seen.has(name)) fail('INVALID_SKILL_ARGUMENT_NAME');
    if (!ARGUMENT_TYPES.has(item.type)) fail('INVALID_SKILL_ARGUMENT_TYPE');
    if (typeof item.required !== 'boolean') fail('INVALID_SKILL_ARGUMENT_REQUIRED');

    const description =
      item.description == null
        ? null
        : requireText(item.description, 'INVALID_SKILL_ARGUMENT_DESCRIPTION', LIMITS.maxArgumentDescriptionLength);
    if (description) rejectSecrets(description, 'SKILL_SECRET_FORBIDDEN');

    seen.add(name);
    args.push(Object.freeze({ name, type: item.type, required: item.required, description }));
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
  if (value == null) return 'inline';
  if (!EXECUTION_MODES.includes(value)) fail('INVALID_SKILL_EXECUTION');
  return value;
}

function normalizePrompt(value) {
  const prompt = typeof value === 'string' ? value.trim() : '';
  if (!prompt || prompt.length > LIMITS.maxPromptLength || PROMPT_CONTROL_PATTERN.test(prompt)) {
    fail('INVALID_SKILL_PROMPT');
  }
  rejectSecrets(prompt, 'SKILL_SECRET_FORBIDDEN');
  return prompt;
}

function normalizeProjectScope(value, source, allowedProjectScopes) {
  if (source !== 'project') {
    if (value != null) fail('SKILL_PROJECT_SCOPE_FORBIDDEN');
    return null;
  }
  const scope = typeof value === 'string' ? value.trim() : '';
  if (!PROJECT_SCOPE_PATTERN.test(scope) || scope.includes('..')) fail('INVALID_SKILL_PROJECT_SCOPE');

  const allowed = new Set(
    (Array.isArray(allowedProjectScopes) ? allowedProjectScopes : [])
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
  );
  if (!allowed.has(scope)) fail('SKILL_PROJECT_SCOPE_NOT_ALLOWED');
  return scope;
}

export function normalizeSkillManifest(input = {}, options = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_SKILL_MANIFEST');
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail('INVALID_SKILL_FIELD');

  const { source, agentAllowedTools = [], allowedProjectScopes = [] } = options;
  const normalizedSource = normalizeSource(source);

  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!ID_PATTERN.test(id)) fail('INVALID_SKILL_ID');

  const name = requireText(input.name, 'INVALID_SKILL_NAME', LIMITS.maxNameLength);
  const description = requireText(input.description, 'INVALID_SKILL_DESCRIPTION', LIMITS.maxDescriptionLength);
  rejectSecrets(description, 'SKILL_SECRET_FORBIDDEN');

  return Object.freeze({
    id,
    source: normalizedSource,
    name,
    description,
    triggers: normalizeTriggers(input.triggers),
    allowedTools: normalizeAllowedTools(input.allowedTools, agentAllowedTools),
    arguments: normalizeArguments(input.arguments),
    model: normalizeModel(input.model),
    execution: normalizeExecution(input.execution),
    prompt: normalizePrompt(input.prompt),
    projectScope: normalizeProjectScope(input.projectScope, normalizedSource, allowedProjectScopes)
  });
}

export const SKILL_SOURCES = SOURCES;
export const SKILL_EXECUTION_MODES = EXECUTION_MODES;
export const SKILL_LIMITS = LIMITS;
