// Hafize skill manifest sözleşmesi: ad, açıklama, tetikleyici, izinli araç,
// argüman, model ve execution context ayrı ayrı doğrulanır. Bu modül yalnızca
// doğrulama ve önceliklendirme yapar; çalıştırma ayrı katmandır.

const NAME_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const SCOPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_./-]{0,127}$/;
const SOURCES = new Set(['builtin', 'user', 'project']);
const EXECUTIONS = new Set(['inline', 'fork']);
const FIELDS = new Set([
  'name', 'description', 'triggers', 'allowedTools', 'arguments', 'model', 'execution', 'scope', 'prompt'
]);
// builtin en güvenilir kaynaktır; bir proje deposu builtin veya user skill
// adını gölgeleyerek güven devralamaz.
const SOURCE_PRIORITY = Object.freeze({ builtin: 3, user: 2, project: 1 });
const CREDENTIAL_PATTERN =
  /(?:api[_-]?key|secret|token|password|passwd|credential|private[_-]?key)\s*[:=]\s*\S/i;
const BEARER_PATTERN = /\bbearer\s+[A-Za-z0-9._-]{8,}/i;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function text(value, code, { min = 1, max = 4096 } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < min || normalized.length > max) fail(code);
  if (CREDENTIAL_PATTERN.test(normalized) || BEARER_PATTERN.test(normalized)) fail('SKILL_MANIFEST_SECRET_REJECTED');
  return normalized;
}

function stringList(value, code, { max = 32, itemMax = 256 } = {}) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > max) fail(code);
  const items = value.map((item) => text(item, code, { max: itemMax }));
  if (new Set(items).size !== items.length) fail(code);
  return Object.freeze(items);
}

function normalizeArguments(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > 16) fail('INVALID_SKILL_MANIFEST_ARGUMENTS');
  const seen = new Set();
  const argumentList = value.map((entry) => {
    if (!entry || Array.isArray(entry) || typeof entry !== 'object') fail('INVALID_SKILL_MANIFEST_ARGUMENTS');
    for (const key of Object.keys(entry)) {
      if (!['name', 'description', 'required'].includes(key)) fail('INVALID_SKILL_MANIFEST_ARGUMENTS');
    }
    const name = text(entry.name, 'INVALID_SKILL_MANIFEST_ARGUMENTS', { max: 64 });
    if (!NAME_PATTERN.test(name) || seen.has(name)) fail('INVALID_SKILL_MANIFEST_ARGUMENTS');
    seen.add(name);
    if (entry.required !== undefined && typeof entry.required !== 'boolean') {
      fail('INVALID_SKILL_MANIFEST_ARGUMENTS');
    }
    return Object.freeze({
      name,
      description: text(entry.description, 'INVALID_SKILL_MANIFEST_ARGUMENTS', { max: 512 }),
      required: entry.required === true
    });
  });
  return Object.freeze(argumentList);
}

export function normalizeSkillManifest(input, { source, allowedTools, allowedProjectScopes } = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_SKILL_MANIFEST');
  if (!SOURCES.has(source)) fail('INVALID_SKILL_MANIFEST_SOURCE');
  if (!(allowedTools instanceof Set)) fail('INVALID_SKILL_MANIFEST_TOOL_POLICY');
  for (const key of Object.keys(input)) if (!FIELDS.has(key)) fail('INVALID_SKILL_MANIFEST_FIELD');

  const name = text(input.name, 'INVALID_SKILL_MANIFEST_NAME', { max: 64 });
  if (!NAME_PATTERN.test(name)) fail('INVALID_SKILL_MANIFEST_NAME');
  const description = text(input.description, 'INVALID_SKILL_MANIFEST_DESCRIPTION', { max: 512 });
  const prompt = text(input.prompt, 'INVALID_SKILL_MANIFEST_PROMPT', { max: 8192 });
  const triggers = stringList(input.triggers, 'INVALID_SKILL_MANIFEST_TRIGGERS');

  const execution = typeof input.execution === 'string' ? input.execution.trim() : 'inline';
  if (!EXECUTIONS.has(execution)) fail('INVALID_SKILL_MANIFEST_EXECUTION');

  // Skill kendi araç yetkisini yükseltemez: talep edilen her araç, host
  // tarafından zaten yetkilendirilmiş küme içinde olmalıdır.
  const requestedTools = stringList(input.allowedTools, 'INVALID_SKILL_MANIFEST_TOOLS');
  for (const tool of requestedTools) if (!allowedTools.has(tool)) fail('SKILL_MANIFEST_TOOL_ESCALATION');

  // inline skill çağıranın turu içinde çalışır; model bağlamını değiştiremez.
  let model = null;
  if (input.model !== undefined) {
    if (execution !== 'fork') fail('SKILL_MANIFEST_INLINE_MODEL_OVERRIDE');
    model = text(input.model, 'INVALID_SKILL_MANIFEST_MODEL', { max: 128 });
  }

  let scope = null;
  if (source === 'project') {
    scope = text(input.scope, 'INVALID_SKILL_MANIFEST_SCOPE', { max: 128 });
    if (!SCOPE_PATTERN.test(scope) || scope.includes('..')) fail('INVALID_SKILL_MANIFEST_SCOPE');
    const allowed = allowedProjectScopes instanceof Set ? allowedProjectScopes : new Set();
    if (!allowed.has(scope)) fail('SKILL_MANIFEST_PROJECT_SCOPE_NOT_ALLOWED');
  } else if (input.scope !== undefined) {
    fail('INVALID_SKILL_MANIFEST_SCOPE');
  }

  return Object.freeze({
    name,
    source,
    description,
    prompt,
    triggers,
    allowedTools: requestedTools,
    arguments: normalizeArguments(input.arguments),
    execution,
    model,
    scope
  });
}

export function buildSkillRegistry(manifests) {
  if (!Array.isArray(manifests) || manifests.length > 256) fail('INVALID_SKILL_REGISTRY');
  const byName = new Map();
  const shadowed = [];
  for (const manifest of manifests) {
    if (!manifest || typeof manifest.name !== 'string' || !SOURCES.has(manifest.source)) fail('INVALID_SKILL_REGISTRY');
    const existing = byName.get(manifest.name);
    if (!existing) {
      byName.set(manifest.name, manifest);
      continue;
    }
    if (SOURCE_PRIORITY[existing.source] === SOURCE_PRIORITY[manifest.source]) fail('SKILL_REGISTRY_DUPLICATE_NAME');
    const winner = SOURCE_PRIORITY[existing.source] > SOURCE_PRIORITY[manifest.source] ? existing : manifest;
    shadowed.push(Object.freeze({
      name: manifest.name,
      ignoredSource: winner === existing ? manifest.source : existing.source,
      keptSource: winner.source
    }));
    byName.set(manifest.name, winner);
  }
  const skills = Object.freeze([...byName.values()].sort((a, b) => a.name.localeCompare(b.name)));
  return Object.freeze({
    skills,
    shadowed: Object.freeze(shadowed),
    get(name) {
      return byName.get(typeof name === 'string' ? name.trim() : '') ?? null;
    }
  });
}

export const SKILL_SOURCES = Object.freeze([...SOURCES]);
export const SKILL_EXECUTIONS = Object.freeze([...EXECUTIONS]);
