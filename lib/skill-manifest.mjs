// Skill manifest sözleşmesi (docs/CLAUDE_RESEARCH_INTEGRATION.md, sıra 2).
// Yalnız doğrulama yapar: skill kendi araç yetkisini yükseltemez, prompt'una
// credential gömemez, project skill'i yalnız izin verilen kapsamdan yüklenir.
// Registry ve yürütme ayrı katmandır.

const SOURCES = Object.freeze(['builtin', 'user', 'project']);
const EXECUTIONS = Object.freeze(['inline', 'fork']);
const SOURCE_SET = new Set(SOURCES);
const EXECUTION_SET = new Set(EXECUTIONS);
const TOP_FIELDS = new Set([
  'id', 'name', 'description', 'source', 'scope', 'triggers',
  'allowedTools', 'arguments', 'model', 'execution', 'prompt'
]);
const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const ARGUMENT_PATTERN = /^[a-z][a-zA-Z0-9_]{0,31}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9.]{1,63}$/;
// Argüman adı olarak credential istemek yasak.
const SECRET_NAME_PATTERN = /(secret|token|password|passphrase|credential|api_?key|private_?key)/i;
// Prompt'a gömülü credential değeri veya ortam değişkeni okuma girişimi.
const EMBEDDED_SECRET_PATTERN = /(secret|token|password|passphrase|credential|api[_-]?key|private[_-]?key)\s*[:=]\s*\S/i;
const ENV_ACCESS_PATTERN = /process\s*\.\s*env|import\s*\.\s*meta\s*\.\s*env/i;
const LIMITS = Object.freeze({ maxTriggers: 16, maxArguments: 12, maxTools: 24, maxPromptLength: 20_000 });

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}
function text(value, code, { min = 1, max = 4096 } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < min || normalized.length > max || normalized.includes('\0')) fail(code);
  return normalized;
}
function uniqueStrings(value, code, { max, pattern = null, forbid = null }) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > max) fail(code);
  const seen = new Set();
  for (const item of value) {
    const entry = text(item, code, { max: 200 });
    if (pattern && !pattern.test(entry)) fail(code);
    if (forbid && forbid.test(entry)) fail(code);
    if (seen.has(entry)) fail(code);
    seen.add(entry);
  }
  return Object.freeze([...seen]);
}
function normalizeAllowedTools(value, allowedPermissions) {
  const requested = uniqueStrings(value, 'INVALID_SKILL_ALLOWED_TOOLS', { max: LIMITS.maxTools, pattern: PERMISSION_PATTERN });
  // En az yetki: skill yalnız host'un zaten sahip olduğu izinleri isteyebilir.
  for (const permission of requested) if (!allowedPermissions.has(permission)) fail('SKILL_TOOL_ESCALATION');
  return requested;
}
function normalizePrompt(value) {
  const prompt = text(value, 'INVALID_SKILL_PROMPT', { max: LIMITS.maxPromptLength });
  if (EMBEDDED_SECRET_PATTERN.test(prompt) || ENV_ACCESS_PATTERN.test(prompt)) fail('SKILL_PROMPT_SECRET_FORBIDDEN');
  return prompt;
}
function normalizeScope(source, scope, allowedProjectScopes) {
  if (source !== 'project') {
    if (scope !== undefined) fail('INVALID_SKILL_SCOPE');
    return null;
  }
  const normalized = text(scope, 'INVALID_SKILL_SCOPE', { max: 200 });
  if (!allowedProjectScopes.has(normalized)) fail('SKILL_PROJECT_SCOPE_NOT_ALLOWED');
  return normalized;
}

export function normalizeSkillManifest(input, { allowedPermissions = [], allowedProjectScopes = [] } = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_SKILL_MANIFEST');
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail('INVALID_SKILL_FIELD');
  if (!Array.isArray(allowedPermissions)) fail('INVALID_SKILL_HOST_PERMISSIONS');
  if (!Array.isArray(allowedProjectScopes)) fail('INVALID_SKILL_PROJECT_SCOPES');

  const id = text(input.id, 'INVALID_SKILL_ID', { max: 64 });
  if (!ID_PATTERN.test(id)) fail('INVALID_SKILL_ID');
  const source = typeof input.source === 'string' ? input.source.trim() : '';
  if (!SOURCE_SET.has(source)) fail('INVALID_SKILL_SOURCE');
  const execution = input.execution === undefined ? 'inline' : String(input.execution).trim();
  if (!EXECUTION_SET.has(execution)) fail('INVALID_SKILL_EXECUTION');

  return Object.freeze({
    id,
    name: text(input.name, 'INVALID_SKILL_NAME', { max: 120 }),
    description: text(input.description, 'INVALID_SKILL_DESCRIPTION', { max: 500 }),
    source,
    scope: normalizeScope(source, input.scope, new Set(allowedProjectScopes)),
    triggers: uniqueStrings(input.triggers, 'INVALID_SKILL_TRIGGERS', { max: LIMITS.maxTriggers }),
    allowedTools: normalizeAllowedTools(input.allowedTools, new Set(allowedPermissions)),
    arguments: uniqueStrings(input.arguments, 'INVALID_SKILL_ARGUMENTS', {
      max: LIMITS.maxArguments, pattern: ARGUMENT_PATTERN, forbid: SECRET_NAME_PATTERN
    }),
    model: input.model === undefined ? null : text(input.model, 'INVALID_SKILL_MODEL', { max: 120 }),
    execution,
    prompt: normalizePrompt(input.prompt)
  });
}

export const SKILL_SOURCES = SOURCES;
export const SKILL_EXECUTIONS = EXECUTIONS;
// Aynı id birden çok kaynakta varsa öncelik: project > user > builtin.
export const SKILL_SOURCE_PRIORITY = Object.freeze({ builtin: 0, user: 1, project: 2 });
export const SKILL_LIMITS = LIMITS;
