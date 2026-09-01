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
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._/-]{1,119}$/i;

const SOURCES = Object.freeze(['builtin', 'user', 'project']);
const EXECUTIONS = Object.freeze(['inline', 'fork']);

// Bir skill kendi yetkisini yükseltemez: bu izinler manifest üzerinden hiç istenemez.
const NEVER_SKILL_PERMISSIONS = new Set([
  'secret.read',
  'repo.delete',
  'repo.merge',
  'external.write',
  'external.send'
]);

// Skill prompt'u secret/credential taşıyamaz; taşıma girişimi manifest'i reddeder.
const SECRET_PROMPT_PATTERNS = [
  /process\.env/i,
  /\$\{?[A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)[A-Z0-9_]*\}?/,
  /\b[A-Z0-9_]*(?:API_KEY|CLIENT_SECRET|ACCESS_TOKEN|REFRESH_TOKEN|PRIVATE_KEY)[A-Z0-9_]*\s*[:=]/,
  /\bBearer\s+[A-Za-z0-9._-]{12,}/,
  /\bsk-[A-Za-z0-9_-]{12,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/
];

const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 400;
const MAX_TRIGGERS = 12;
const MAX_TRIGGER_LENGTH = 120;
const MAX_ALLOWED_TOOLS = 16;
const MAX_ARGUMENTS = 8;
const MAX_ARGUMENT_DESCRIPTION_LENGTH = 200;
const MAX_PROMPT_LENGTH = 20_000;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function cleanLine(value, maxLength, code) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || /[\r\n\0]/.test(text)) fail(code);
  return text;
}

function normalizeSource(value) {
  if (!SOURCES.includes(value)) fail('INVALID_SKILL_SOURCE');
  return value;
}

function normalizeTriggers(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_TRIGGERS) fail('INVALID_SKILL_TRIGGERS');

  const triggers = [];
  const seen = new Set();
  for (const item of value) {
    const trigger = cleanLine(item, MAX_TRIGGER_LENGTH, 'INVALID_SKILL_TRIGGER').toLowerCase();
    if (seen.has(trigger)) fail('INVALID_SKILL_TRIGGER');
    seen.add(trigger);
    triggers.push(trigger);
  }
  return Object.freeze(triggers);
}

function normalizeAllowedTools(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_ALLOWED_TOOLS) fail('INVALID_SKILL_ALLOWED_TOOLS');

  const tools = [];
  const seen = new Set();
  for (const item of value) {
    const tool = typeof item === 'string' ? item.trim() : '';
    if (!PERMISSION_PATTERN.test(tool)) fail('INVALID_SKILL_ALLOWED_TOOL');
    if (NEVER_SKILL_PERMISSIONS.has(tool)) fail('SKILL_TOOL_ESCALATION_NOT_ALLOWED');
    if (seen.has(tool)) fail('INVALID_SKILL_ALLOWED_TOOL');
    seen.add(tool);
    tools.push(tool);
  }
  return Object.freeze(tools);
}

function normalizeArguments(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_ARGUMENTS) fail('INVALID_SKILL_ARGUMENTS');

  const argumentList = [];
  const seen = new Set();
  for (const item of value) {
    if (!item || Array.isArray(item) || typeof item !== 'object') fail('INVALID_SKILL_ARGUMENT');
    for (const field of Object.keys(item)) if (!ARGUMENT_FIELDS.has(field)) fail('INVALID_SKILL_ARGUMENT_FIELD');

    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!ARGUMENT_NAME_PATTERN.test(name) || seen.has(name)) fail('INVALID_SKILL_ARGUMENT_NAME');
    seen.add(name);

    if (item.required != null && typeof item.required !== 'boolean') fail('INVALID_SKILL_ARGUMENT_REQUIRED');

    argumentList.push(Object.freeze({
      name,
      description: cleanLine(item.description, MAX_ARGUMENT_DESCRIPTION_LENGTH, 'INVALID_SKILL_ARGUMENT_DESCRIPTION'),
      required: item.required === true
    }));
  }
  return Object.freeze(argumentList);
}

function normalizeModel(value) {
  if (value == null) return null;
  const model = typeof value === 'string' ? value.trim() : '';
  if (!MODEL_PATTERN.test(model)) fail('INVALID_SKILL_MODEL');
  return model;
}

function normalizeExecution(value, source) {
  const execution = value == null ? 'inline' : value;
  if (!EXECUTIONS.includes(execution)) fail('INVALID_SKILL_EXECUTION');
  // fork, ayrı bağlamda tam tur çalıştırır; güvenilmeyen proje kaynağı bunu isteyemez.
  if (execution === 'fork' && source === 'project') fail('SKILL_FORK_EXECUTION_NOT_ALLOWED');
  return execution;
}

function normalizePrompt(value) {
  if (typeof value !== 'string') fail('INVALID_SKILL_PROMPT');
  const prompt = value.trim();
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH || prompt.includes('\0')) fail('INVALID_SKILL_PROMPT');
  for (const pattern of SECRET_PROMPT_PATTERNS) {
    if (pattern.test(prompt)) fail('SKILL_PROMPT_SECRET_NOT_ALLOWED');
  }
  return prompt;
}

export function normalizeSkillManifest(input = {}, { source, projectScopeAllowed = false } = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_SKILL_MANIFEST');
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail('INVALID_SKILL_MANIFEST_FIELD');

  const normalizedSource = normalizeSource(source);
  if (normalizedSource === 'project' && projectScopeAllowed !== true) fail('SKILL_PROJECT_SCOPE_NOT_ALLOWED');

  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!ID_PATTERN.test(id)) fail('INVALID_SKILL_ID');

  return Object.freeze({
    id,
    source: normalizedSource,
    name: cleanLine(input.name, MAX_NAME_LENGTH, 'INVALID_SKILL_NAME'),
    description: cleanLine(input.description, MAX_DESCRIPTION_LENGTH, 'INVALID_SKILL_DESCRIPTION'),
    triggers: normalizeTriggers(input.triggers),
    allowedTools: normalizeAllowedTools(input.allowedTools),
    arguments: normalizeArguments(input.arguments),
    model: normalizeModel(input.model),
    execution: normalizeExecution(input.execution, normalizedSource),
    prompt: normalizePrompt(input.prompt)
  });
}

/**
 * Skill'in isteyebileceği araçları ajan policy'siyle kesiştirir. Skill hiçbir zaman
 * ajanın sahip olmadığı bir yetkiyi kazanamaz; onay gerektiren araçlar skill
 * yolundan otomatik onay almaz.
 */
export function resolveSkillTools(manifest, agentAllowedTools = []) {
  if (!manifest || typeof manifest !== 'object') fail('INVALID_SKILL_MANIFEST');
  const agentTools = new Set(
    (Array.isArray(agentAllowedTools) ? agentAllowedTools : [])
      .filter((tool) => typeof tool === 'string' && PERMISSION_PATTERN.test(tool.trim()))
      .map((tool) => tool.trim())
  );

  const granted = [];
  const rejected = [];
  for (const tool of manifest.allowedTools || []) {
    if (agentTools.has(tool)) granted.push(tool);
    else rejected.push(tool);
  }

  return Object.freeze({
    granted: Object.freeze(granted),
    rejected: Object.freeze(rejected)
  });
}

export const SKILL_MANIFEST_LIMITS = Object.freeze({
  sources: SOURCES,
  executions: EXECUTIONS,
  maxTriggers: MAX_TRIGGERS,
  maxAllowedTools: MAX_ALLOWED_TOOLS,
  maxArguments: MAX_ARGUMENTS,
  maxPromptLength: MAX_PROMPT_LENGTH,
  neverSkillPermissions: Object.freeze([...NEVER_SKILL_PERMISSIONS])
});
