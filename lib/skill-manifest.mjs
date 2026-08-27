const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const ARGUMENT_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/;
const PROJECT_PATH_PATTERN = /^[A-Za-z0-9._/-]{1,200}$/;

// Skill kendi tool yetkisini yükseltemez: bu izinler manifest seviyesinde reddedilir.
const FORBIDDEN_SKILL_TOOLS = new Set([
  'secret.read', 'repo.delete', 'repo.merge', 'external.write', 'external.send', 'repo.write_branch'
]);

const SECRET_PATTERNS = [
  /\b(?:sk|rk)-[A-Za-z0-9_-]{16,}/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bAIza[0-9A-Za-z_-]{20,}/,
  /\bnvapi-[A-Za-z0-9_-]{16,}/,
  /\bBearer\s+[A-Za-z0-9._-]{20,}/i,
  /\b[A-Z][A-Z0-9_]{2,}(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)S?\s*[:=]\s*\S/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/
];

export const SKILL_SOURCES = Object.freeze(['builtin', 'user', 'project']);
export const SKILL_EXECUTIONS = Object.freeze(['inline', 'fork']);

function invalid(field) {
  return { ok: false, error: `INVALID_SKILL:${field}` };
}

function text(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

export function containsSecretMaterial(value) {
  return typeof value === 'string' && SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

function normalizeStringList(value, { max, maxLength, lowercase = false }) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) return null;
  const list = [];
  for (const item of value) {
    const entry = text(item, maxLength);
    if (!entry) return null;
    const normalized = lowercase ? entry.toLowerCase() : entry;
    if (list.includes(normalized)) return null;
    list.push(normalized);
  }
  return list;
}

function normalizeTools(value) {
  const tools = normalizeStringList(value, { max: 16, maxLength: 120, lowercase: true });
  if (!tools) return null;
  const safe = tools.every((tool) => PERMISSION_PATTERN.test(tool) && !FORBIDDEN_SKILL_TOOLS.has(tool));
  return safe ? tools : null;
}

function normalizeArguments(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 8) return null;
  const args = [];
  const seen = new Set();
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const name = text(item.name, 32);
    if (!name || !ARGUMENT_PATTERN.test(name) || seen.has(name)) return null;
    const description = text(item.description, 200);
    if (item.description !== undefined && !description) return null;
    if (item.required !== undefined && typeof item.required !== 'boolean') return null;
    seen.add(name);
    args.push(Object.freeze({ name, required: item.required === true, description: description || '' }));
  }
  return args;
}

// Project skill yalnız açıkça izin verilen, göreli proje kapsamından yüklenir.
function normalizeProjectPath(rawPath, projectScope) {
  const path = text(rawPath, 200);
  if (!path || !PROJECT_PATH_PATTERN.test(path)) return null;
  if (path.startsWith('/') || path.split('/').includes('..')) return null;
  if (!Array.isArray(projectScope) || projectScope.length === 0) return null;
  const allowed = projectScope.some((prefix) => {
    const scope = text(prefix, 200);
    if (!scope || scope.startsWith('/') || scope.split('/').includes('..')) return false;
    return path.startsWith(scope.endsWith('/') ? scope : `${scope}/`);
  });
  return allowed ? path : null;
}

// Strict doğrulama: geçersiz alan sessizce düzeltilmez, manifest reddedilir.
export function normalizeSkillManifest(raw, { source, projectScope = [] } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return invalid('manifest');
  if (!SKILL_SOURCES.includes(source)) return invalid('source');

  const id = text(raw.id, 64);
  if (!id || !ID_PATTERN.test(id)) return invalid('id');
  const name = text(raw.name, 80);
  if (!name) return invalid('name');
  const description = text(raw.description, 400);
  if (!description) return invalid('description');
  const triggers = normalizeStringList(raw.triggers, { max: 12, maxLength: 80, lowercase: true });
  if (!triggers) return invalid('triggers');
  const allowedTools = normalizeTools(raw.allowedTools);
  if (!allowedTools) return invalid('allowedTools');
  const args = normalizeArguments(raw.arguments);
  if (!args) return invalid('arguments');

  const execution = raw.execution === undefined ? 'inline' : raw.execution;
  if (!SKILL_EXECUTIONS.includes(execution)) return invalid('execution');

  let model = '';
  if (raw.model !== undefined) {
    model = text(raw.model, 120);
    if (!model || !MODEL_PATTERN.test(model)) return invalid('model');
  }

  const prompt = text(raw.prompt, 8000);
  if (!prompt) return invalid('prompt');
  // Skill prompt'u secret veya credential alamaz.
  if (containsSecretMaterial(prompt) || containsSecretMaterial(description) || containsSecretMaterial(name)) {
    return invalid('secretMaterial');
  }

  let path = '';
  if (source === 'project') {
    path = normalizeProjectPath(raw.path, projectScope);
    if (!path) return invalid('projectScope');
  }

  return {
    ok: true,
    skill: Object.freeze({
      id,
      name,
      description,
      source,
      execution,
      model,
      prompt,
      path,
      triggers: Object.freeze(triggers),
      allowedTools: Object.freeze(allowedTools),
      arguments: Object.freeze(args)
    })
  };
}
