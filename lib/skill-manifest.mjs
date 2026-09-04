const ID_PATTERN = /^[a-z][a-z0-9-]{1,47}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._/-]{0,79}$/i;
const ARGUMENT_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const SCOPE_PATTERN = /^[a-z0-9][a-z0-9._/-]{0,79}$/;
const SECRET_PATTERN = /(api[_ -]?key|secret|password|credential|private[_ -]?key|bearer\s|authorization:|process\.env|-----BEGIN)/i;

const TOP_FIELDS = new Set(['id', 'name', 'description', 'source', 'execution', 'triggers', 'allowedTools', 'arguments', 'model', 'prompt', 'projectScope']);
const ARGUMENT_FIELDS = new Set(['name', 'type', 'required', 'maxLength']);
const SOURCES = new Set(['builtin', 'user', 'project']);
const EXECUTIONS = new Set(['inline', 'fork']);
const ARGUMENT_TYPES = new Set(['string', 'number', 'boolean']);

// Bir skill kendi yetkisini yükseltemez: onay gerektiren veya hiçbir zaman
// verilmeyen izinler manifest içinde talep edilemez.
const FORBIDDEN_TOOLS = new Set(['secret.read', 'repo.delete', 'repo.merge', 'repo.write_branch', 'external.write', 'external.send']);

const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 400;
const MAX_TRIGGERS = 12;
const MAX_TRIGGER_LENGTH = 48;
const MAX_TOOLS = 12;
const MAX_ARGUMENTS = 8;
const MAX_PROMPT_LENGTH = 8_000;
const MAX_STRING_ARGUMENT_LENGTH = 4_000;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

const plainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function requireText(value, maxLength, code) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || /[\0\r]/.test(text)) fail(code);
  return text;
}

function uniqueList(value, max, code, normalize) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > max) fail(code);
  const seen = new Set();
  for (const entry of value) {
    const item = normalize(entry);
    if (seen.has(item)) fail(code);
    seen.add(item);
  }
  return Object.freeze([...seen]);
}

function normalizeTrigger(entry) {
  const trigger = typeof entry === 'string' ? entry.trim().toLowerCase() : '';
  if (!trigger || trigger.length > MAX_TRIGGER_LENGTH) fail('INVALID_SKILL_TRIGGERS');
  return trigger;
}

function normalizeTool(entry) {
  const tool = typeof entry === 'string' ? entry.trim() : '';
  if (!PERMISSION_PATTERN.test(tool)) fail('INVALID_SKILL_ALLOWED_TOOLS');
  if (FORBIDDEN_TOOLS.has(tool)) fail('SKILL_TOOL_ESCALATION_FORBIDDEN');
  return tool;
}

function normalizeArgument(entry) {
  if (!plainObject(entry)) fail('INVALID_SKILL_ARGUMENT');
  for (const field of Object.keys(entry)) if (!ARGUMENT_FIELDS.has(field)) fail('INVALID_SKILL_ARGUMENT');
  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  if (!ARGUMENT_PATTERN.test(name)) fail('INVALID_SKILL_ARGUMENT');
  if (!ARGUMENT_TYPES.has(entry.type)) fail('INVALID_SKILL_ARGUMENT');
  if (entry.required !== undefined && typeof entry.required !== 'boolean') fail('INVALID_SKILL_ARGUMENT');

  let maxLength = entry.type === 'string' ? MAX_STRING_ARGUMENT_LENGTH : undefined;
  if (entry.maxLength !== undefined) {
    const valid = entry.type === 'string' && Number.isInteger(entry.maxLength)
      && entry.maxLength >= 1 && entry.maxLength <= MAX_STRING_ARGUMENT_LENGTH;
    if (!valid) fail('INVALID_SKILL_ARGUMENT');
    maxLength = entry.maxLength;
  }
  return Object.freeze({ name, type: entry.type, required: entry.required === true, ...(maxLength === undefined ? {} : { maxLength }) });
}

function normalizeArguments(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_ARGUMENTS) fail('INVALID_SKILL_ARGUMENT');
  const args = value.map(normalizeArgument);
  if (new Set(args.map((argument) => argument.name)).size !== args.length) fail('INVALID_SKILL_ARGUMENT');
  return Object.freeze(args);
}

function normalizePrompt(value) {
  const prompt = typeof value === 'string' ? value.trim() : '';
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH || prompt.includes('\0')) fail('INVALID_SKILL_PROMPT');
  // Skill prompt'u secret veya credential taşıyamaz; bunlar yalnız backend ortamında kalır.
  if (SECRET_PATTERN.test(prompt)) fail('SKILL_PROMPT_SECRET_FORBIDDEN');
  return prompt;
}

function normalizeProjectScope(value, source) {
  if (source !== 'project') {
    if (value !== undefined) fail('INVALID_SKILL_PROJECT_SCOPE');
    return undefined;
  }
  const scope = typeof value === 'string' ? value.trim() : '';
  if (!SCOPE_PATTERN.test(scope)) fail('INVALID_SKILL_PROJECT_SCOPE');
  return scope;
}

export function normalizeSkillManifest(input) {
  if (!plainObject(input)) fail('INVALID_SKILL_MANIFEST');
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail('INVALID_SKILL_FIELD');

  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!ID_PATTERN.test(id)) fail('INVALID_SKILL_ID');
  if (!SOURCES.has(input.source)) fail('INVALID_SKILL_SOURCE');
  if (!EXECUTIONS.has(input.execution)) fail('INVALID_SKILL_EXECUTION');
  const model = input.model === undefined ? undefined : (typeof input.model === 'string' ? input.model.trim() : '');
  if (model !== undefined && !MODEL_PATTERN.test(model)) fail('INVALID_SKILL_MODEL');
  const projectScope = normalizeProjectScope(input.projectScope, input.source);

  return Object.freeze({
    id,
    name: requireText(input.name, MAX_NAME_LENGTH, 'INVALID_SKILL_NAME'),
    description: requireText(input.description, MAX_DESCRIPTION_LENGTH, 'INVALID_SKILL_DESCRIPTION'),
    source: input.source,
    execution: input.execution,
    triggers: uniqueList(input.triggers, MAX_TRIGGERS, 'INVALID_SKILL_TRIGGERS', normalizeTrigger),
    allowedTools: uniqueList(input.allowedTools, MAX_TOOLS, 'INVALID_SKILL_ALLOWED_TOOLS', normalizeTool),
    arguments: normalizeArguments(input.arguments),
    prompt: normalizePrompt(input.prompt),
    ...(model === undefined ? {} : { model }),
    ...(projectScope === undefined ? {} : { projectScope })
  });
}

export const SKILL_LIMITS = Object.freeze({
  maxTriggers: MAX_TRIGGERS, maxTriggerLength: MAX_TRIGGER_LENGTH, maxTools: MAX_TOOLS,
  maxArguments: MAX_ARGUMENTS, maxPromptLength: MAX_PROMPT_LENGTH, maxStringArgumentLength: MAX_STRING_ARGUMENT_LENGTH
});

export const SKILL_FORBIDDEN_TOOLS = Object.freeze([...FORBIDDEN_TOOLS]);
