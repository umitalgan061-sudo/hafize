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
const ARGUMENT_FIELDS = new Set(['name', 'description', 'required']);
const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._/-]{1,79}$/i;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const EXECUTION_MODES = new Set(['inline', 'fork']);
const SKILL_SOURCES = Object.freeze(['builtin', 'user', 'project']);
const NEVER_SKILL_TOOLS = new Set(['secret.read', 'repo.delete']);
const APPROVAL_ONLY_TOOLS = new Set(['external.write', 'external.send', 'repo.merge', 'repo.write_branch']);
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bsk-[A-Za-z0-9]{16,}\b/,
  /\bnvapi-[A-Za-z0-9_-]{16,}\b/,
  /\b(api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|password)\s*[:=]\s*\S+/i
];

export const SKILL_LIMITS = Object.freeze({
  maxNameLength: 80,
  maxDescriptionLength: 400,
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

function requireText(value, { max, code }) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max || /[\0\r]/.test(text)) fail(code);
  return text;
}

function normalizeTriggers(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > SKILL_LIMITS.maxTriggers) fail('INVALID_SKILL_TRIGGERS');

  const triggers = [];
  const seen = new Set();
  for (const item of value) {
    const trigger = typeof item === 'string' ? item.trim().toLowerCase() : '';
    if (!trigger || trigger.length > SKILL_LIMITS.maxTriggerLength || /[\0\r\n]/.test(trigger)) {
      fail('INVALID_SKILL_TRIGGER');
    }
    if (seen.has(trigger)) fail('INVALID_SKILL_TRIGGER');
    seen.add(trigger);
    triggers.push(trigger);
  }
  return Object.freeze(triggers);
}

function normalizeAllowedTools(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > SKILL_LIMITS.maxAllowedTools) fail('INVALID_SKILL_ALLOWED_TOOLS');

  const tools = [];
  const seen = new Set();
  for (const item of value) {
    const tool = typeof item === 'string' ? item.trim() : '';
    if (!PERMISSION_PATTERN.test(tool)) fail('INVALID_SKILL_ALLOWED_TOOL');
    if (seen.has(tool)) fail('INVALID_SKILL_ALLOWED_TOOL');
    if (NEVER_SKILL_TOOLS.has(tool)) fail(`SKILL_FORBIDDEN_TOOL:${tool}`);
    if (APPROVAL_ONLY_TOOLS.has(tool)) fail(`SKILL_APPROVAL_ONLY_TOOL:${tool}`);
    seen.add(tool);
    tools.push(tool);
  }
  return Object.freeze(tools);
}

function normalizeArguments(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > SKILL_LIMITS.maxArguments) fail('INVALID_SKILL_ARGUMENTS');

  const args = [];
  const seen = new Set();
  for (const item of value) {
    if (!item || Array.isArray(item) || typeof item !== 'object') fail('INVALID_SKILL_ARGUMENT');
    for (const field of Object.keys(item)) if (!ARGUMENT_FIELDS.has(field)) fail('INVALID_SKILL_ARGUMENT_FIELD');

    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!ARGUMENT_NAME_PATTERN.test(name) || seen.has(name)) fail('INVALID_SKILL_ARGUMENT');
    if (item.required != null && typeof item.required !== 'boolean') fail('INVALID_SKILL_ARGUMENT');
    seen.add(name);

    args.push(
      Object.freeze({
        name,
        description: requireText(item.description, {
          max: SKILL_LIMITS.maxDescriptionLength,
          code: 'INVALID_SKILL_ARGUMENT'
        }),
        required: item.required === true
      })
    );
  }
  return Object.freeze(args);
}

function normalizePrompt(value) {
  if (typeof value !== 'string') fail('INVALID_SKILL_PROMPT');
  const prompt = value.trim();
  if (!prompt || prompt.length > SKILL_LIMITS.maxPromptLength || prompt.includes('\0')) fail('INVALID_SKILL_PROMPT');
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(prompt)) fail('SKILL_PROMPT_SECRET_SUSPECTED');
  }
  return prompt;
}

export function normalizeSkillManifest(input = {}, { source, projectScopeAllowed = false } = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_SKILL_MANIFEST');
  if (!SKILL_SOURCES.includes(source)) fail('INVALID_SKILL_SOURCE');
  if (source === 'project' && projectScopeAllowed !== true) fail('SKILL_PROJECT_SCOPE_NOT_ALLOWED');
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail('INVALID_SKILL_FIELD');

  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!ID_PATTERN.test(id)) fail('INVALID_SKILL_ID');

  const model = input.model == null ? null : typeof input.model === 'string' ? input.model.trim() : '';
  if (model !== null && !MODEL_PATTERN.test(model)) fail('INVALID_SKILL_MODEL');

  const execution = input.execution == null ? 'inline' : input.execution;
  if (!EXECUTION_MODES.has(execution)) fail('INVALID_SKILL_EXECUTION');

  return Object.freeze({
    id,
    source,
    name: requireText(input.name, { max: SKILL_LIMITS.maxNameLength, code: 'INVALID_SKILL_NAME' }),
    description: requireText(input.description, {
      max: SKILL_LIMITS.maxDescriptionLength,
      code: 'INVALID_SKILL_DESCRIPTION'
    }),
    triggers: normalizeTriggers(input.triggers),
    allowedTools: normalizeAllowedTools(input.allowedTools),
    arguments: normalizeArguments(input.arguments),
    model,
    execution,
    prompt: normalizePrompt(input.prompt)
  });
}

export { SKILL_SOURCES };
