const TOP_FIELDS = new Set([
  'name',
  'description',
  'triggers',
  'allowedTools',
  'arguments',
  'model',
  'executionContext',
  'forkAgentId',
  'prompt'
]);

const SOURCES = Object.freeze(['builtin', 'user', 'project']);
const EXECUTION_CONTEXTS = Object.freeze(['inline', 'fork']);

const NAME_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-zA-Z0-9_]{0,39}$/;
const MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,79}$/;
const AGENT_ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;

const MAX_TRIGGERS = 12;
const MAX_TOOLS = 16;
const MAX_ARGUMENTS = 8;
const MAX_DESCRIPTION_LENGTH = 300;
const MAX_TRIGGER_LENGTH = 120;
const MAX_PROMPT_LENGTH = 20_000;

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bgh[pousr]_[A-Za-z0-9]{16,}/,
  /\bnvapi-[A-Za-z0-9_-]{16,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:api[_-]?key|secret|token|password|client[_-]?secret)\b\s*[:=]\s*\S{8,}/i
];

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function text(value, code, maxLength) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || result.length > maxLength || /[\0]/.test(result)) fail(code);
  return result;
}

function rejectUnknownFields(input) {
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail('INVALID_SKILL_FIELD');
}

function normalizeTriggers(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_TRIGGERS) fail('INVALID_SKILL_TRIGGERS');
  const triggers = [];
  const seen = new Set();
  for (const item of value) {
    const trigger = text(item, 'INVALID_SKILL_TRIGGER', MAX_TRIGGER_LENGTH).toLowerCase();
    if (seen.has(trigger)) fail('INVALID_SKILL_TRIGGER');
    seen.add(trigger);
    triggers.push(trigger);
  }
  return Object.freeze(triggers);
}

function normalizeAllowedTools(value, grantedTools) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_TOOLS) fail('INVALID_SKILL_ALLOWED_TOOLS');
  const tools = [];
  const seen = new Set();
  for (const item of value) {
    const tool = typeof item === 'string' ? item.trim() : '';
    if (!PERMISSION_PATTERN.test(tool) || seen.has(tool)) fail('INVALID_SKILL_ALLOWED_TOOL');
    if (!grantedTools.has(tool)) fail('SKILL_TOOL_ESCALATION');
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
    for (const field of Object.keys(item)) {
      if (!['name', 'description', 'required'].includes(field)) fail('INVALID_SKILL_ARGUMENT');
    }
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!ARGUMENT_NAME_PATTERN.test(name) || seen.has(name)) fail('INVALID_SKILL_ARGUMENT');
    if (item.required != null && typeof item.required !== 'boolean') fail('INVALID_SKILL_ARGUMENT');
    seen.add(name);
    args.push(
      Object.freeze({
        name,
        description: text(item.description, 'INVALID_SKILL_ARGUMENT', MAX_DESCRIPTION_LENGTH),
        required: item.required === true
      })
    );
  }
  return Object.freeze(args);
}

function normalizePrompt(value) {
  const prompt = text(value, 'INVALID_SKILL_PROMPT', MAX_PROMPT_LENGTH);
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(prompt)) fail('SKILL_PROMPT_SECRET_DETECTED');
  }
  return prompt;
}

function normalizeExecution(input) {
  const executionContext = input.executionContext == null ? 'inline' : input.executionContext;
  if (!EXECUTION_CONTEXTS.includes(executionContext)) fail('INVALID_SKILL_EXECUTION_CONTEXT');
  if (executionContext === 'inline') {
    if (input.forkAgentId != null) fail('INVALID_SKILL_FORK_AGENT');
    return { executionContext, forkAgentId: null };
  }
  const forkAgentId = typeof input.forkAgentId === 'string' ? input.forkAgentId.trim() : '';
  if (!AGENT_ID_PATTERN.test(forkAgentId)) fail('INVALID_SKILL_FORK_AGENT');
  return { executionContext, forkAgentId };
}

// Skill kendi yetkisini yükseltemez: `allowedTools` yalnız `grantedTools` alt kümesi olabilir,
// `project` kaynağı açık izin ister ve prompt secret benzeri içerik taşıyamaz.
export function normalizeSkillManifest(input = {}, { source, grantedTools = [], projectScopeAllowed = false } = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_SKILL_MANIFEST');
  if (!SOURCES.includes(source)) fail('INVALID_SKILL_SOURCE');
  if (source === 'project' && projectScopeAllowed !== true) fail('SKILL_PROJECT_SOURCE_NOT_ALLOWED');
  rejectUnknownFields(input);

  const granted = new Set();
  for (const item of Array.isArray(grantedTools) ? grantedTools : []) {
    if (typeof item === 'string' && item.trim()) granted.add(item.trim());
  }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!NAME_PATTERN.test(name)) fail('INVALID_SKILL_NAME');

  const { executionContext, forkAgentId } = normalizeExecution(input);
  const model = input.model == null ? null : text(input.model, 'INVALID_SKILL_MODEL', 80);
  if (model !== null && !MODEL_PATTERN.test(model)) fail('INVALID_SKILL_MODEL');

  return Object.freeze({
    name,
    source,
    description: text(input.description, 'INVALID_SKILL_DESCRIPTION', MAX_DESCRIPTION_LENGTH),
    triggers: normalizeTriggers(input.triggers),
    allowedTools: normalizeAllowedTools(input.allowedTools, granted),
    arguments: normalizeArguments(input.arguments),
    model,
    executionContext,
    forkAgentId,
    prompt: normalizePrompt(input.prompt)
  });
}

export const SKILL_MANIFEST_CONTRACT = Object.freeze({
  sources: SOURCES,
  executionContexts: EXECUTION_CONTEXTS,
  maxTriggers: MAX_TRIGGERS,
  maxTools: MAX_TOOLS,
  maxArguments: MAX_ARGUMENTS,
  maxDescriptionLength: MAX_DESCRIPTION_LENGTH,
  maxPromptLength: MAX_PROMPT_LENGTH
});
