const NAME_PATTERN = /^[a-z][a-z0-9-]{1,47}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const ARGUMENT_PATTERN = /^[a-z][a-zA-Z0-9_]{0,31}$/;
const MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,119}$/;

export const SKILL_SOURCES = Object.freeze(['builtin', 'user', 'project']);
export const SKILL_EXECUTIONS = Object.freeze(['inline', 'fork']);

const NEVER_SKILL_PERMISSIONS = new Set(['secret.read', 'repo.delete']);
const APPROVAL_ONLY_PERMISSIONS = new Set(['external.write', 'external.send', 'repo.merge', 'repo.write_branch']);

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9]{16,}\b/,
  /\bnvapi-[A-Za-z0-9_-]{16,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{16,}\b/,
  /\bAKIA[0-9A-Z]{12,}\b/,
  /\b(?:api[_-]?key|secret|token|password|client[_-]?secret)\s*[:=]\s*["']?[A-Za-z0-9._/+-]{12,}/i
];

const MAX_DESCRIPTION = 500;
const MAX_PROMPT = 20_000;
const MAX_TRIGGERS = 12;
const MAX_TRIGGER_LENGTH = 64;
const MAX_TOOLS = 16;
const MAX_ARGUMENTS = 8;

function failed(error) {
  return { ok: false, error };
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringList(value, { max, maxLength, pattern, lowercase = false }) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > max) return null;

  const items = [];
  for (const entry of value) {
    let item = cleanString(entry);
    if (lowercase) item = item.toLowerCase();
    if (!item || item.length > maxLength) return null;
    if (pattern && !pattern.test(item)) return null;
    if (items.includes(item)) return null;
    items.push(item);
  }
  return items;
}

function normalizeArguments(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_ARGUMENTS) return null;

  const names = new Set();
  const args = [];
  for (const entry of value) {
    const name = cleanString(entry?.name);
    if (!ARGUMENT_PATTERN.test(name) || names.has(name)) return null;
    const description = cleanString(entry?.description);
    if (description.length > MAX_DESCRIPTION) return null;
    if (entry?.required !== undefined && typeof entry.required !== 'boolean') return null;
    const maxLength = entry?.maxLength === undefined ? 2000 : entry.maxLength;
    if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 20_000) return null;
    names.add(name);
    args.push(Object.freeze({
      name,
      description,
      required: entry?.required === true,
      maxLength
    }));
  }
  return args;
}

export function containsSecretMaterial(text) {
  const value = typeof text === 'string' ? text : '';
  return SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Bir skill manifesti strict olarak doğrular. Manifest kendi tool yetkisini
 * yükseltemez: onay gerektiren veya asla verilmeyen izinler manifestte
 * bildirilemez. Prompt gövdesi secret/credential materyali taşıyamaz.
 */
export function normalizeSkillManifest(input, { source } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return failed('INVALID_SKILL_MANIFEST');
  if (!SKILL_SOURCES.includes(source)) return failed('INVALID_SKILL_SOURCE');

  const name = cleanString(input.name).toLowerCase();
  if (!NAME_PATTERN.test(name)) return failed('INVALID_SKILL_NAME');

  const description = cleanString(input.description);
  if (!description || description.length > MAX_DESCRIPTION) return failed('INVALID_SKILL_DESCRIPTION');

  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
  if (!prompt || prompt.length > MAX_PROMPT) return failed('INVALID_SKILL_PROMPT');
  if (containsSecretMaterial(prompt) || containsSecretMaterial(description)) return failed('SKILL_PROMPT_SECRET_MATERIAL');

  const triggers = normalizeStringList(input.triggers, {
    max: MAX_TRIGGERS,
    maxLength: MAX_TRIGGER_LENGTH,
    lowercase: true
  });
  if (triggers === null) return failed('INVALID_SKILL_TRIGGERS');

  const allowedTools = normalizeStringList(input.allowedTools, {
    max: MAX_TOOLS,
    maxLength: 120,
    pattern: PERMISSION_PATTERN
  });
  if (allowedTools === null) return failed('INVALID_SKILL_TOOLS');
  for (const tool of allowedTools) {
    if (NEVER_SKILL_PERMISSIONS.has(tool)) return failed(`SKILL_TOOL_FORBIDDEN:${tool}`);
    if (APPROVAL_ONLY_PERMISSIONS.has(tool)) return failed(`SKILL_TOOL_APPROVAL_ONLY:${tool}`);
  }

  const args = normalizeArguments(input.arguments);
  if (args === null) return failed('INVALID_SKILL_ARGUMENTS');

  const execution = input.execution === undefined ? 'inline' : cleanString(input.execution);
  if (!SKILL_EXECUTIONS.includes(execution)) return failed('INVALID_SKILL_EXECUTION');

  let model = null;
  if (input.model !== undefined && input.model !== null) {
    model = cleanString(input.model);
    if (!MODEL_PATTERN.test(model)) return failed('INVALID_SKILL_MODEL');
  }

  let scope = null;
  if (source === 'project') {
    scope = cleanString(input.scope);
    if (!scope || scope.length > 200) return failed('INVALID_SKILL_SCOPE');
  } else if (input.scope !== undefined && cleanString(input.scope)) {
    return failed('SKILL_SCOPE_NOT_ALLOWED');
  }

  return {
    ok: true,
    skill: Object.freeze({
      name,
      description,
      source,
      scope,
      triggers: Object.freeze(triggers),
      allowedTools: Object.freeze(allowedTools),
      arguments: Object.freeze(args),
      execution,
      model,
      prompt
    })
  };
}
