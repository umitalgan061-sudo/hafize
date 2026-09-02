const SOURCES = Object.freeze(['builtin', 'user', 'project']);
const EXECUTION_MODES = Object.freeze(['inline', 'fork']);
const MODEL_PREFERENCES = Object.freeze(['default', 'fast', 'reasoning']);

const TOP_FIELDS = new Set(['id', 'name', 'description', 'triggers', 'allowedTools', 'arguments', 'model', 'execution', 'prompt']);
const ARGUMENT_FIELDS = new Set(['name', 'type', 'description', 'required']);
const ARGUMENT_TYPES = new Set(['string', 'number', 'boolean']);

const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-zA-Z0-9_]{0,39}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const PROJECT_ORIGIN_PATTERN = /^[a-zA-Z0-9._/-]{1,300}$/;

const FORBIDDEN_TOOLS = new Set(['secret.read', 'repo.delete']);
const APPROVAL_ONLY_TOOLS = new Set(['external.write', 'external.send', 'repo.merge', 'repo.write_branch']);
const CREDENTIAL_PATTERN = /(process\.env|api[_ -]?key|client[_ -]?secret|access[_ -]?token|refresh[_ -]?token|private[_ -]?key|password|bearer\s|-----BEGIN)/i;

const LIMITS = Object.freeze({
  maxNameLength: 80,
  maxDescriptionLength: 500,
  maxTriggers: 12,
  maxTriggerLength: 64,
  maxTools: 12,
  maxArguments: 8,
  maxPromptLength: 10_000
});

function fail(field) {
  const error = new Error(`INVALID_SKILL_MANIFEST:${field}`);
  error.code = `INVALID_SKILL_MANIFEST:${field}`;
  throw error;
}

function plainText(value, field, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || /[\0\r]/.test(text)) fail(field);
  return text;
}

function rejectCredentialLike(text, field) {
  if (CREDENTIAL_PATTERN.test(text)) fail(field);
  return text;
}

function normalizeTriggers(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > LIMITS.maxTriggers) fail('triggers');
  const triggers = [];
  const seen = new Set();
  for (const item of value) {
    // Tetikleyici eşleşmesi Türkçe metinlerde de tutarlı olsun diye locale-aware küçültülür.
    const trigger = typeof item === 'string' ? item.trim().toLocaleLowerCase('tr') : '';
    if (!trigger || trigger.length > LIMITS.maxTriggerLength || /[\0\r\n]/.test(trigger)) fail('triggers.item');
    if (seen.has(trigger)) fail('triggers.duplicate');
    seen.add(trigger);
    triggers.push(trigger);
  }
  return Object.freeze(triggers);
}

function normalizeTools(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > LIMITS.maxTools) fail('allowedTools');
  const tools = [];
  const seen = new Set();
  for (const item of value) {
    const tool = typeof item === 'string' ? item.trim() : '';
    if (!PERMISSION_PATTERN.test(tool)) fail('allowedTools.item');
    if (seen.has(tool)) fail('allowedTools.duplicate');
    if (FORBIDDEN_TOOLS.has(tool)) fail(`allowedTools.forbidden:${tool}`);
    if (APPROVAL_ONLY_TOOLS.has(tool)) fail(`allowedTools.approvalRequired:${tool}`);
    seen.add(tool);
    tools.push(tool);
  }
  return Object.freeze(tools);
}

function normalizeArgument(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('arguments.item');
  for (const field of Object.keys(input)) if (!ARGUMENT_FIELDS.has(field)) fail(`arguments.field:${field}`);

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!ARGUMENT_NAME_PATTERN.test(name)) fail('arguments.name');
  if (!ARGUMENT_TYPES.has(input.type)) fail('arguments.type');
  if (input.required !== undefined && typeof input.required !== 'boolean') fail('arguments.required');

  const description = rejectCredentialLike(
    plainText(input.description, 'arguments.description', LIMITS.maxDescriptionLength),
    'arguments.description.credential'
  );

  return Object.freeze({
    name,
    type: input.type,
    description,
    required: input.required === true
  });
}

function normalizeArguments(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > LIMITS.maxArguments) fail('arguments');
  const args = [];
  const seen = new Set();
  for (const item of value) {
    const argument = normalizeArgument(item);
    if (seen.has(argument.name)) fail('arguments.duplicate');
    seen.add(argument.name);
    args.push(argument);
  }
  return Object.freeze(args);
}

function normalizeOrigin(source, origin, allowedProjectRoots) {
  if (source !== 'project') {
    if (origin !== undefined) fail('origin.unexpected');
    return null;
  }
  const path = typeof origin === 'string' ? origin.trim() : '';
  if (!PROJECT_ORIGIN_PATTERN.test(path) || path.startsWith('/')) fail('origin');
  if (path.split('/').some((segment) => segment === '..' || segment === '')) fail('origin.traversal');
  if (!Array.isArray(allowedProjectRoots) || allowedProjectRoots.length === 0) fail('origin.projectScopeMissing');
  const allowed = allowedProjectRoots.some((root) => {
    const prefix = typeof root === 'string' ? root.trim().replace(/\/+$/, '') : '';
    return Boolean(prefix) && (path === prefix || path.startsWith(`${prefix}/`));
  });
  if (!allowed) fail('origin.projectScope');
  return path;
}

export function normalizeSkillManifest(input = {}, { source, origin, allowedProjectRoots = [] } = {}) {
  if (!SOURCES.includes(source)) fail('source');
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('manifest');
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail(`field:${field}`);

  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!ID_PATTERN.test(id)) fail('id');

  const execution = input.execution === undefined ? 'inline' : input.execution;
  if (!EXECUTION_MODES.includes(execution)) fail('execution');

  const model = input.model === undefined ? 'default' : input.model;
  if (!MODEL_PREFERENCES.includes(model)) fail('model');

  const prompt = rejectCredentialLike(
    plainText(input.prompt, 'prompt', LIMITS.maxPromptLength),
    'prompt.credential'
  );

  return Object.freeze({
    id,
    source,
    origin: normalizeOrigin(source, origin, allowedProjectRoots),
    name: plainText(input.name, 'name', LIMITS.maxNameLength),
    description: plainText(input.description, 'description', LIMITS.maxDescriptionLength),
    triggers: normalizeTriggers(input.triggers),
    allowedTools: normalizeTools(input.allowedTools),
    arguments: normalizeArguments(input.arguments),
    model,
    execution,
    prompt
  });
}

export const SKILL_SOURCES = SOURCES;
export const SKILL_EXECUTION_MODES = EXECUTION_MODES;
export const SKILL_MODEL_PREFERENCES = MODEL_PREFERENCES;
export const SKILL_MANIFEST_LIMITS = LIMITS;
