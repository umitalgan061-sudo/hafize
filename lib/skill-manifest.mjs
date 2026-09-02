const TOP_FIELDS = new Set(['name', 'description', 'triggers', 'allowedTools', 'arguments', 'model', 'execution', 'agentId', 'prompt']);
const ARGUMENT_FIELDS = new Set(['name', 'description', 'required']);
const SOURCES = new Set(['builtin', 'user', 'project']);
const EXECUTION_MODES = new Set(['inline', 'fork']);
const NAME_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const TOOL_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const ARGUMENT_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._/-]{0,79}$/;
const SCOPE_PATTERN = /^[a-z0-9][a-z0-9._/-]{0,119}$/;
const NEVER_SKILL_TOOLS = new Set(['secret.read', 'repo.delete']);
const APPROVAL_ONLY_TOOLS = new Set(['external.write', 'external.send', 'repo.merge', 'repo.write_branch']);
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9]{16,}/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bnvapi-[A-Za-z0-9_-]{16,}/,
  /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|refresh[_-]?token|password)\s*[:=]\s*["']?[A-Za-z0-9_\-.]{12,}/i
];

export const SKILL_LIMITS = Object.freeze({
  maxTriggers: 12,
  maxTriggerLength: 80,
  maxTools: 16,
  maxArguments: 8,
  maxDescriptionLength: 300,
  maxPromptLength: 20_000
});

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function assertNoSecret(text, code) {
  for (const pattern of SECRET_PATTERNS) if (pattern.test(text)) fail(code);
}

function normalizeText(value, maxLength, code) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || text.includes('\0')) fail(code);
  return text;
}

function normalizeTriggers(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > SKILL_LIMITS.maxTriggers) fail('INVALID_SKILL_TRIGGERS');
  const triggers = [];
  const seen = new Set();
  for (const item of value) {
    const trigger = normalizeText(item, SKILL_LIMITS.maxTriggerLength, 'INVALID_SKILL_TRIGGER').toLowerCase();
    if (seen.has(trigger)) fail('INVALID_SKILL_TRIGGER');
    seen.add(trigger);
    triggers.push(trigger);
  }
  return Object.freeze(triggers);
}

function normalizeTools(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > SKILL_LIMITS.maxTools) fail('INVALID_SKILL_TOOLS');
  const tools = [];
  const seen = new Set();
  for (const item of value) {
    const tool = typeof item === 'string' ? item.trim() : '';
    if (!TOOL_PATTERN.test(tool) || seen.has(tool)) fail('INVALID_SKILL_TOOL');
    if (NEVER_SKILL_TOOLS.has(tool)) fail('SKILL_TOOL_FORBIDDEN');
    if (APPROVAL_ONLY_TOOLS.has(tool)) fail('SKILL_TOOL_APPROVAL_ONLY');
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
    if (!ARGUMENT_PATTERN.test(name) || seen.has(name)) fail('INVALID_SKILL_ARGUMENT');
    if (item.required !== undefined && typeof item.required !== 'boolean') fail('INVALID_SKILL_ARGUMENT');
    seen.add(name);
    args.push(Object.freeze({
      name,
      required: item.required === true,
      description: item.description === undefined
        ? ''
        : normalizeText(item.description, SKILL_LIMITS.maxDescriptionLength, 'INVALID_SKILL_ARGUMENT')
    }));
  }
  return Object.freeze(args);
}

function normalizeSource(source, scope) {
  if (!SOURCES.has(source)) fail('INVALID_SKILL_SOURCE');
  if (source === 'project') {
    const value = typeof scope === 'string' ? scope.trim() : '';
    if (!SCOPE_PATTERN.test(value)) fail('INVALID_SKILL_PROJECT_SCOPE');
    return value;
  }
  if (scope !== undefined && scope !== null) fail('INVALID_SKILL_PROJECT_SCOPE');
  return null;
}

export function normalizeSkillManifest(input = {}, { source, scope } = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_SKILL_MANIFEST');
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail('INVALID_SKILL_MANIFEST_FIELD');

  const resolvedScope = normalizeSource(source, scope);
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!NAME_PATTERN.test(name)) fail('INVALID_SKILL_NAME');

  const description = normalizeText(input.description, SKILL_LIMITS.maxDescriptionLength, 'INVALID_SKILL_DESCRIPTION');
  const prompt = normalizeText(input.prompt, SKILL_LIMITS.maxPromptLength, 'INVALID_SKILL_PROMPT');
  assertNoSecret(description, 'SKILL_DESCRIPTION_SECRET_DETECTED');
  assertNoSecret(prompt, 'SKILL_PROMPT_SECRET_DETECTED');

  const execution = input.execution === undefined || input.execution === null
    ? 'inline'
    : (typeof input.execution === 'string' ? input.execution.trim() : '');
  if (!EXECUTION_MODES.has(execution)) fail('INVALID_SKILL_EXECUTION');

  const agentId = input.agentId === undefined || input.agentId === null
    ? null
    : (typeof input.agentId === 'string' ? input.agentId.trim() : '');
  if (execution === 'fork') {
    if (!agentId || !NAME_PATTERN.test(agentId)) fail('SKILL_FORK_AGENT_REQUIRED');
  } else if (agentId !== null) {
    fail('SKILL_INLINE_AGENT_NOT_ALLOWED');
  }

  const model = input.model === undefined || input.model === null
    ? null
    : (typeof input.model === 'string' ? input.model.trim() : '');
  if (model !== null && !MODEL_PATTERN.test(model)) fail('INVALID_SKILL_MODEL');

  return Object.freeze({
    name,
    description,
    triggers: normalizeTriggers(input.triggers),
    allowedTools: normalizeTools(input.allowedTools),
    arguments: normalizeArguments(input.arguments),
    model,
    execution,
    agentId: execution === 'fork' ? agentId : null,
    prompt,
    source,
    projectScope: resolvedScope
  });
}
