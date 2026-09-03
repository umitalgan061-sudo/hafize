const NAME_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const ARGUMENT_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const TOOL_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._\/-]{0,119}$/i;
const TOP_FIELDS = new Set(['name', 'description', 'triggers', 'allowedTools', 'arguments', 'model', 'execution', 'prompt']);
const ARGUMENT_FIELDS = new Set(['name', 'required', 'description']);
const EXECUTION_MODES = new Set(['inline', 'fork']);
const NEVER_SKILL_TOOLS = new Set(['secret.read', 'repo.delete']);
const APPROVAL_ONLY_TOOLS = new Set(['external.write', 'external.send', 'repo.merge', 'repo.write_branch']);
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bgh[pousr]_[A-Za-z0-9]{16,}/,
  /\bnvapi-[A-Za-z0-9_-]{16,}/,
  /\bAKIA[0-9A-Z]{12,}/,
  /\bauthorization\s*:\s*bearer\s+\S/i,
  /\b(api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|password)\b\s*[:=]\s*\S/i
];
const MAX_DESCRIPTION_LENGTH = 300;
const MAX_TRIGGERS = 12;
const MAX_TRIGGER_LENGTH = 64;
const MAX_TOOLS = 16;
const MAX_ARGUMENTS = 8;
const MAX_PROMPT_LENGTH = 20_000;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function containsSecretMaterial(value) {
  return typeof value === 'string' && SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

function normalizeName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!NAME_PATTERN.test(name)) fail('INVALID_SKILL_NAME');
  return name;
}

function normalizeDescription(value) {
  const description = typeof value === 'string' ? value.trim() : '';
  if (!description || description.length > MAX_DESCRIPTION_LENGTH || /[\0\r\n]/.test(description)) fail('INVALID_SKILL_DESCRIPTION');
  return description;
}

function normalizeTriggers(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_TRIGGERS) fail('INVALID_SKILL_TRIGGERS');
  const triggers = [];
  for (const item of value) {
    const trigger = typeof item === 'string' ? item.trim().toLowerCase() : '';
    if (!trigger || trigger.length > MAX_TRIGGER_LENGTH || /[\0\r\n]/.test(trigger)) fail('INVALID_SKILL_TRIGGERS');
    if (triggers.includes(trigger)) fail('INVALID_SKILL_TRIGGERS');
    triggers.push(trigger);
  }
  return Object.freeze(triggers);
}

function normalizeTools(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_TOOLS) fail('INVALID_SKILL_TOOLS');
  const tools = [];
  for (const item of value) {
    const tool = typeof item === 'string' ? item.trim() : '';
    if (!TOOL_PATTERN.test(tool) || tools.includes(tool)) fail('INVALID_SKILL_TOOLS');
    if (NEVER_SKILL_TOOLS.has(tool)) fail(`FORBIDDEN_SKILL_TOOL:${tool}`);
    tools.push(tool);
  }
  return Object.freeze(tools);
}

function normalizeArguments(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_ARGUMENTS) fail('INVALID_SKILL_ARGUMENTS');
  const args = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail('INVALID_SKILL_ARGUMENTS');
    for (const field of Object.keys(item)) if (!ARGUMENT_FIELDS.has(field)) fail('INVALID_SKILL_ARGUMENT_FIELD');
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!ARGUMENT_PATTERN.test(name) || args.some((argument) => argument.name === name)) fail('INVALID_SKILL_ARGUMENTS');
    if (item.required !== undefined && typeof item.required !== 'boolean') fail('INVALID_SKILL_ARGUMENTS');
    args.push(Object.freeze({
      name,
      required: item.required === true,
      description: item.description === undefined ? '' : normalizeDescription(item.description)
    }));
  }
  return Object.freeze(args);
}

function normalizeModel(value) {
  if (value === undefined) return '';
  const model = typeof value === 'string' ? value.trim() : '';
  if (!MODEL_PATTERN.test(model)) fail('INVALID_SKILL_MODEL');
  return model;
}

function normalizeExecution(value, tools) {
  const execution = value === undefined ? 'inline' : value;
  if (typeof execution !== 'string' || !EXECUTION_MODES.has(execution)) fail('INVALID_SKILL_EXECUTION');
  if (execution === 'inline' && tools.some((tool) => APPROVAL_ONLY_TOOLS.has(tool))) fail('INVALID_SKILL_EXECUTION:approval_requires_fork');
  return execution;
}

function normalizePrompt(value) {
  const prompt = typeof value === 'string' ? value.trim() : '';
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH || prompt.includes('\0')) fail('INVALID_SKILL_PROMPT');
  if (containsSecretMaterial(prompt)) fail('SKILL_PROMPT_SECRET_MATERIAL');
  return prompt;
}

export function normalizeSkillManifest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_SKILL_MANIFEST');
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail('INVALID_SKILL_FIELD');
  const allowedTools = normalizeTools(input.allowedTools);
  return Object.freeze({
    name: normalizeName(input.name),
    description: normalizeDescription(input.description),
    triggers: normalizeTriggers(input.triggers),
    allowedTools,
    arguments: normalizeArguments(input.arguments),
    model: normalizeModel(input.model),
    execution: normalizeExecution(input.execution, allowedTools),
    prompt: normalizePrompt(input.prompt)
  });
}

export const SKILL_MANIFEST_LIMITS = Object.freeze({
  maxTriggers: MAX_TRIGGERS,
  maxTools: MAX_TOOLS,
  maxArguments: MAX_ARGUMENTS,
  maxPromptLength: MAX_PROMPT_LENGTH,
  approvalOnlyTools: Object.freeze([...APPROVAL_ONLY_TOOLS]),
  neverSkillTools: Object.freeze([...NEVER_SKILL_TOOLS])
});
