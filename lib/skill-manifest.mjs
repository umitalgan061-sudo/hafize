const SCHEMA_VERSION = 1;
const NAME_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-zA-Z0-9_]{0,39}$/;
const NEVER_SKILL_PERMISSIONS = new Set(['secret.read', 'repo.delete']);
const APPROVAL_ONLY_PERMISSIONS = new Set(['external.write', 'external.send', 'repo.merge', 'repo.write_branch']);
const ALLOWED_MANIFEST_KEYS = new Set([
  'schemaVersion',
  'name',
  'description',
  'version',
  'triggers',
  'execution',
  'forkAgentId',
  'allowedTools',
  'approvalRequiredTools',
  'arguments',
  'model',
  'prompt'
]);
const ALLOWED_ARGUMENT_KEYS = new Set(['name', 'description', 'required', 'maxLength']);
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bgh[pousr]_[A-Za-z0-9]{16,}/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{20,}/,
  /\bprocess\.env\b/,
  /\b(?:[A-Z0-9]+_)?(?:API_KEY|ACCESS_TOKEN|REFRESH_TOKEN|CLIENT_SECRET|PRIVATE_KEY|PASSWORD)\b/
];

export const SKILL_EXECUTION_MODES = Object.freeze(['inline', 'fork']);

function fail(field) {
  throw new Error(`INVALID_SKILL_MANIFEST:${field}`);
}

function requireString(value, field, maxLength) {
  if (typeof value !== 'string') fail(field);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) fail(field);
  return trimmed;
}

function optionalStringList(value, field, { maxItems, maxLength }) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems) fail(field);

  const items = [];
  for (const item of value) {
    const text = requireString(item, `${field}.item`, maxLength);
    if (items.includes(text)) fail(`${field}.duplicate:${text}`);
    items.push(text);
  }
  return items;
}

function permissionList(value, field) {
  const items = optionalStringList(value, field, { maxItems: 24, maxLength: 120 });
  for (const item of items) {
    if (!PERMISSION_PATTERN.test(item)) fail(`${field}.permission`);
    if (NEVER_SKILL_PERMISSIONS.has(item)) fail(`${field}.forbidden:${item}`);
  }
  return items;
}

function parseSkillArguments(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 12) fail('arguments');

  const names = new Set();
  return value.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('arguments.item');
    for (const key of Object.keys(raw)) {
      if (!ALLOWED_ARGUMENT_KEYS.has(key)) fail(`arguments.unknownKey:${key}`);
    }

    const name = requireString(raw.name, 'arguments.name', 40);
    if (!ARGUMENT_NAME_PATTERN.test(name)) fail('arguments.name');
    if (names.has(name)) fail(`arguments.duplicate:${name}`);
    names.add(name);

    const description = requireString(raw.description, 'arguments.description', 300);
    if (raw.required !== undefined && typeof raw.required !== 'boolean') fail('arguments.required');

    let maxLength = 2000;
    if (raw.maxLength !== undefined) {
      if (!Number.isInteger(raw.maxLength) || raw.maxLength < 1 || raw.maxLength > 20000) fail('arguments.maxLength');
      maxLength = raw.maxLength;
    }

    return Object.freeze({ name, description, required: raw.required === true, maxLength });
  });
}

function assertNoSecretMaterial(raw) {
  const serialized = JSON.stringify(raw);
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(serialized)) fail('secretMaterial');
  }
}

export function parseSkillManifest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('manifest');
  if (raw.schemaVersion !== SCHEMA_VERSION) fail('schemaVersion');
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_MANIFEST_KEYS.has(key)) fail(`unknownKey:${key}`);
  }
  assertNoSecretMaterial(raw);

  const name = requireString(raw.name, 'name', 64);
  if (!NAME_PATTERN.test(name)) fail('name');

  const execution = requireString(raw.execution, 'execution', 16);
  if (!SKILL_EXECUTION_MODES.includes(execution)) fail('execution');

  const allowedTools = permissionList(raw.allowedTools, 'allowedTools');
  for (const permission of allowedTools) {
    if (APPROVAL_ONLY_PERMISSIONS.has(permission)) fail(`allowedTools.approvalRequired:${permission}`);
  }
  const approvalRequiredTools = permissionList(raw.approvalRequiredTools, 'approvalRequiredTools');
  for (const permission of approvalRequiredTools) {
    if (allowedTools.includes(permission)) fail(`approvalRequiredTools.overlap:${permission}`);
  }

  let forkAgentId = null;
  if (execution === 'fork') {
    forkAgentId = requireString(raw.forkAgentId, 'forkAgentId', 64);
    if (!NAME_PATTERN.test(forkAgentId)) fail('forkAgentId');
  } else if (raw.forkAgentId !== undefined) {
    fail('forkAgentId.inline');
  }

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    name,
    description: requireString(raw.description, 'description', 500),
    version: raw.version === undefined ? null : requireString(raw.version, 'version', 32),
    triggers: Object.freeze(optionalStringList(raw.triggers, 'triggers', { maxItems: 16, maxLength: 200 })),
    execution,
    forkAgentId,
    allowedTools: Object.freeze(allowedTools),
    approvalRequiredTools: Object.freeze(approvalRequiredTools),
    arguments: Object.freeze(parseSkillArguments(raw.arguments)),
    model: raw.model === undefined ? null : requireString(raw.model, 'model', 120),
    prompt: requireString(raw.prompt, 'prompt', 20000)
  });
}
