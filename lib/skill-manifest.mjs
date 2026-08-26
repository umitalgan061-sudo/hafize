const SOURCE_TRUST = Object.freeze({ builtin: 3, user: 2, project: 1 });
const EXECUTION_MODES = new Set(['inline', 'fork']);
const TOP_FIELDS = new Set(['id', 'name', 'description', 'triggers', 'allowedTools', 'arguments', 'model', 'execution', 'prompt', 'projectScope']);
const ARGUMENT_FIELDS = new Set(['name', 'description', 'required']);

const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const TOOL_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,119}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-zA-Z0-9_]{0,31}$/;
const SCOPE_PATTERN = /^[a-z][a-z0-9._/-]{0,119}$/;

const FORBIDDEN_TOOLS = new Set(['secret.read', 'repo.delete']);
const SECRET_LIKE = /(secret|token|password|passwd|credential|apikey|api_key|private_key|access_key)/i;
const SECRET_INTERPOLATION = [/process\s*\.\s*env/i, /\$\{/];

const MAX_TRIGGERS = 12;
const MAX_TOOLS = 16;
const MAX_ARGUMENTS = 8;
const MAX_PROMPT_LENGTH = 20_000;
const MAX_DESCRIPTION_LENGTH = 400;

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function plainObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }

function text(value, field, max) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > max || /[\0\r]/.test(normalized)) fail(`INVALID_SKILL_MANIFEST:${field}`);
  return normalized;
}

function normalizeTriggers(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_TRIGGERS) fail('INVALID_SKILL_MANIFEST:triggers');
  const triggers = [];
  const seen = new Set();
  for (const item of value) {
    const trigger = typeof item === 'string' ? item.trim().toLowerCase() : '';
    if (trigger.length < 2 || trigger.length > 80 || /[\0\r\n]/.test(trigger)) fail('INVALID_SKILL_MANIFEST:trigger');
    if (seen.has(trigger)) fail('INVALID_SKILL_MANIFEST:trigger.duplicate');
    seen.add(trigger);
    triggers.push(trigger);
  }
  return Object.freeze(triggers);
}

function normalizeTools(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_TOOLS) fail('INVALID_SKILL_MANIFEST:allowedTools');
  const tools = [];
  for (const item of value) {
    const tool = typeof item === 'string' ? item.trim() : '';
    if (!TOOL_PATTERN.test(tool)) fail('INVALID_SKILL_MANIFEST:allowedTool');
    if (FORBIDDEN_TOOLS.has(tool)) fail(`SKILL_FORBIDDEN_TOOL:${tool}`);
    if (tools.includes(tool)) fail('INVALID_SKILL_MANIFEST:allowedTool.duplicate');
    tools.push(tool);
  }
  return Object.freeze(tools);
}

function normalizeArguments(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_ARGUMENTS) fail('INVALID_SKILL_MANIFEST:arguments');
  const args = [];
  const seen = new Set();
  for (const item of value) {
    if (!plainObject(item)) fail('INVALID_SKILL_MANIFEST:argument');
    for (const field of Object.keys(item)) if (!ARGUMENT_FIELDS.has(field)) fail('INVALID_SKILL_MANIFEST:argument.field');
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!ARGUMENT_NAME_PATTERN.test(name)) fail('INVALID_SKILL_MANIFEST:argument.name');
    if (SECRET_LIKE.test(name)) fail(`SKILL_SECRET_ARGUMENT:${name}`);
    if (seen.has(name)) fail('INVALID_SKILL_MANIFEST:argument.duplicate');
    if (item.required !== undefined && typeof item.required !== 'boolean') fail('INVALID_SKILL_MANIFEST:argument.required');
    seen.add(name);
    args.push(Object.freeze({
      name,
      required: item.required === true,
      description: item.description === undefined ? '' : text(item.description, 'argument.description', MAX_DESCRIPTION_LENGTH)
    }));
  }
  return Object.freeze(args);
}

function normalizePrompt(value) {
  const prompt = text(value, 'prompt', MAX_PROMPT_LENGTH);
  for (const pattern of SECRET_INTERPOLATION) if (pattern.test(prompt)) fail('SKILL_PROMPT_SECRET_INTERPOLATION');
  return prompt;
}

/**
 * Strict skill manifest doğrulaması. Bilinmeyen alan, secret sızdıran argüman/prompt
 * ve yetki yükseltmeye açık araç bildirimi sessizce düzeltilmez; reddedilir.
 */
export function normalizeSkillManifest(input, { source } = {}) {
  if (!Object.hasOwn(SOURCE_TRUST, source)) fail('INVALID_SKILL_MANIFEST:source');
  if (!plainObject(input)) fail('INVALID_SKILL_MANIFEST:manifest');
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail('INVALID_SKILL_MANIFEST:field');

  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!ID_PATTERN.test(id)) fail('INVALID_SKILL_MANIFEST:id');

  const execution = typeof input.execution === 'string' ? input.execution.trim() : '';
  if (!EXECUTION_MODES.has(execution)) fail('INVALID_SKILL_MANIFEST:execution');

  let model = '';
  if (input.model !== undefined) {
    model = typeof input.model === 'string' ? input.model.trim() : '';
    if (!MODEL_PATTERN.test(model)) fail('INVALID_SKILL_MANIFEST:model');
  }

  let projectScope = '';
  if (source === 'project') {
    projectScope = typeof input.projectScope === 'string' ? input.projectScope.trim() : '';
    if (!SCOPE_PATTERN.test(projectScope)) fail('INVALID_SKILL_MANIFEST:projectScope');
  } else if (input.projectScope !== undefined) {
    fail('INVALID_SKILL_MANIFEST:projectScope.unexpected');
  }

  return Object.freeze({
    id,
    source,
    trust: SOURCE_TRUST[source],
    name: text(input.name, 'name', 120),
    description: text(input.description, 'description', MAX_DESCRIPTION_LENGTH),
    triggers: normalizeTriggers(input.triggers),
    allowedTools: normalizeTools(input.allowedTools),
    arguments: normalizeArguments(input.arguments),
    model,
    execution,
    prompt: normalizePrompt(input.prompt),
    projectScope
  });
}

export const SKILL_MANIFEST_LIMITS = Object.freeze({
  maxTriggers: MAX_TRIGGERS,
  maxTools: MAX_TOOLS,
  maxArguments: MAX_ARGUMENTS,
  maxPromptLength: MAX_PROMPT_LENGTH
});

export const SKILL_SOURCE_TRUST = SOURCE_TRUST;
