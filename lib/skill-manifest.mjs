const TOP_FIELDS = new Set([
  'id',
  'name',
  'description',
  'source',
  'projectScope',
  'triggers',
  'allowedTools',
  'arguments',
  'model',
  'execution',
  'prompt'
]);
const ARGUMENT_FIELDS = new Set(['name', 'description', 'required', 'maxLength']);
const SOURCES = new Set(['builtin', 'user', 'project']);
const EXECUTIONS = new Set(['inline', 'fork']);
const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const ARGUMENT_PATTERN = /^[a-z][a-zA-Z0-9_]{0,31}$/;
const MODEL_PATTERN = /^[a-z][a-z0-9._/-]{1,127}$/;
const PROJECT_SCOPE_PATTERN = /^[a-z0-9][a-z0-9._/-]{0,127}$/;
const FORBIDDEN_PERMISSIONS = new Set(['secret.read', 'repo.delete']);
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:api[_-]?key|secret|token|password|credential|authorization)\b\s*[:=]\s*\S/i,
  /\bbearer\s+[A-Za-z0-9._-]{12,}/i,
  /\bnvapi-[A-Za-z0-9._-]{8,}/,
  /\bgh[pousr]_[A-Za-z0-9]{16,}/
];
const MAX_TRIGGERS = 12;
const MAX_ALLOWED_TOOLS = 16;
const MAX_ARGUMENTS = 8;
const MAX_PROMPT_LENGTH = 20_000;

function fail(reason) {
  const error = new Error(`INVALID_SKILL_MANIFEST:${reason}`);
  error.code = 'INVALID_SKILL_MANIFEST';
  error.reason = reason;
  throw error;
}

function strictObject(value, field, allowed) {
  if (!value || Array.isArray(value) || typeof value !== 'object') fail(field);
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail(`${field}.${key}`);
  return value;
}

function text(value, field, { min = 1, max = 512 } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < min || normalized.length > max || normalized.includes('\0')) fail(field);
  return normalized;
}

function uniqueList(value, field, { max, pattern, maxLength = 200 }) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > max) fail(field);
  const items = [];
  const seen = new Set();
  for (const item of value) {
    const normalized = text(item, field, { max: maxLength });
    if (pattern && !pattern.test(normalized)) fail(field);
    const key = normalized.toLowerCase();
    if (seen.has(key)) fail(`${field}.duplicate`);
    seen.add(key);
    items.push(normalized);
  }
  return Object.freeze(items);
}

function normalizeAllowedTools(value) {
  const tools = uniqueList(value, 'allowedTools', {
    max: MAX_ALLOWED_TOOLS,
    pattern: PERMISSION_PATTERN,
    maxLength: 120
  });
  for (const tool of tools) if (FORBIDDEN_PERMISSIONS.has(tool)) fail(`allowedTools.forbidden:${tool}`);
  return tools;
}

function normalizeArguments(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_ARGUMENTS) fail('arguments');
  const args = [];
  const seen = new Set();
  for (const item of value) {
    const entry = strictObject(item, 'arguments.entry', ARGUMENT_FIELDS);
    const name = text(entry.name, 'arguments.name', { max: 32 });
    if (!ARGUMENT_PATTERN.test(name)) fail('arguments.name');
    if (seen.has(name)) fail('arguments.duplicate');
    seen.add(name);
    if (entry.required !== undefined && typeof entry.required !== 'boolean') fail('arguments.required');
    if (entry.maxLength !== undefined) {
      if (!Number.isInteger(entry.maxLength) || entry.maxLength < 1 || entry.maxLength > 10_000) {
        fail('arguments.maxLength');
      }
    }
    args.push(
      Object.freeze({
        name,
        description: entry.description === undefined ? '' : text(entry.description, 'arguments.description'),
        required: entry.required === true,
        maxLength: entry.maxLength === undefined ? 2_000 : entry.maxLength
      })
    );
  }
  return Object.freeze(args);
}

function normalizePrompt(value) {
  const prompt = text(value, 'prompt', { min: 8, max: MAX_PROMPT_LENGTH });
  for (const pattern of SECRET_PATTERNS) if (pattern.test(prompt)) fail('prompt.secret');
  return prompt;
}

export function normalizeSkillManifest(input) {
  const manifest = strictObject(input, 'manifest', TOP_FIELDS);

  const id = text(manifest.id, 'id', { max: 64 });
  if (!ID_PATTERN.test(id)) fail('id');

  const source = text(manifest.source, 'source', { max: 16 });
  if (!SOURCES.has(source)) fail('source');

  const execution = manifest.execution === undefined ? 'inline' : text(manifest.execution, 'execution', { max: 16 });
  if (!EXECUTIONS.has(execution)) fail('execution');

  let projectScope = null;
  if (source === 'project') {
    projectScope = text(manifest.projectScope, 'projectScope', { max: 128 });
    if (!PROJECT_SCOPE_PATTERN.test(projectScope) || projectScope.includes('..')) fail('projectScope');
  } else if (manifest.projectScope !== undefined) {
    fail('projectScope.unexpected');
  }

  let model = null;
  if (manifest.model !== undefined) {
    model = text(manifest.model, 'model', { max: 128 }).toLowerCase();
    if (!MODEL_PATTERN.test(model)) fail('model');
  }

  return Object.freeze({
    id,
    name: text(manifest.name, 'name', { max: 120 }),
    description: text(manifest.description, 'description', { max: 500 }),
    source,
    projectScope,
    execution,
    model,
    triggers: uniqueList(manifest.triggers, 'triggers', { max: MAX_TRIGGERS, maxLength: 120 }),
    allowedTools: normalizeAllowedTools(manifest.allowedTools),
    arguments: normalizeArguments(manifest.arguments),
    prompt: normalizePrompt(manifest.prompt)
  });
}

export const SKILL_MANIFEST_LIMITS = Object.freeze({
  maxTriggers: MAX_TRIGGERS,
  maxAllowedTools: MAX_ALLOWED_TOOLS,
  maxArguments: MAX_ARGUMENTS,
  maxPromptLength: MAX_PROMPT_LENGTH,
  sources: Object.freeze([...SOURCES]),
  executions: Object.freeze([...EXECUTIONS])
});
