const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const TOOL_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const ARGUMENT_PATTERN = /^[a-z][a-zA-Z0-9_]{0,31}$/;
const MODEL_PATTERN = /^[a-z0-9][a-zA-Z0-9._/-]{0,119}$/;
const SKILL_SOURCES = Object.freeze(['builtin', 'user', 'project']);
const SKILL_EXECUTIONS = Object.freeze(['inline', 'fork']);
const ARGUMENT_TYPES = Object.freeze(['string', 'number', 'boolean']);

// Bir skill kendi araç yetkisini yükseltemez: onay gerektiren veya hiçbir zaman
// ajana verilmeyen izinler manifest seviyesinde reddedilir.
const FORBIDDEN_SKILL_TOOLS = Object.freeze([
  'secret.read', 'repo.delete', 'repo.merge', 'repo.write_branch', 'external.write', 'external.send'
]);
const SECRET_HINT_PATTERN = /(api[_-]?key|secret|token|password|passwd|credential|bearer\s|private[_-]?key)/i;

const MAX_TRIGGERS = 12;
const MAX_TOOLS = 16;
const MAX_ARGUMENTS = 8;
const MAX_PROMPT_CHARS = 8000;

function fail(field) {
  return { ok: false, error: `INVALID_SKILL_MANIFEST:${field}` };
}

function text(value, maxLength) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

function normalizeStringList(value, { field, maxItems, maxLength, pattern, lowercase = false }) {
  if (value === undefined) return { ok: true, items: [] };
  if (!Array.isArray(value) || value.length > maxItems) return fail(field);
  const items = [];
  for (const entry of value) {
    let item = text(entry, maxLength);
    if (!item) return fail(field);
    if (lowercase) item = item.toLowerCase();
    if (pattern && !pattern.test(item)) return fail(field);
    if (items.includes(item)) return fail(`${field}.duplicate`);
    items.push(item);
  }
  return { ok: true, items };
}

function normalizeArguments(value) {
  if (value === undefined) return { ok: true, items: [] };
  if (!Array.isArray(value) || value.length > MAX_ARGUMENTS) return fail('arguments');
  const items = [];
  for (const entry of value) {
    const name = text(entry?.name, 32);
    if (!name || !ARGUMENT_PATTERN.test(name)) return fail('arguments.name');
    if (items.some((item) => item.name === name)) return fail(`arguments.duplicate:${name}`);
    if (SECRET_HINT_PATTERN.test(name)) return fail(`arguments.secretLike:${name}`);
    const type = entry?.type === undefined ? 'string' : entry.type;
    if (!ARGUMENT_TYPES.includes(type)) return fail('arguments.type');
    if (entry?.required !== undefined && typeof entry.required !== 'boolean') return fail('arguments.required');
    const description = entry?.description === undefined ? '' : text(entry.description, 200);
    if (description === null) return fail('arguments.description');
    items.push(Object.freeze({ name, type, required: entry?.required === true, description }));
  }
  return { ok: true, items };
}

/**
 * Strict skill manifest doğrulaması. Kaynak (`builtin` / `user` / `project`)
 * çağıran tarafından verilir; manifest kendi kaynağını veya güven seviyesini
 * seçemez. `project` kaynaklı skill yalnız açıkça izin verilen proje
 * kapsamlarından yüklenebilir.
 */
export function normalizeSkillManifest(manifest, { source, allowedProjectScopes = [] } = {}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return fail('manifest');
  if (!SKILL_SOURCES.includes(source)) return fail('source');

  const id = text(manifest.id, 64);
  if (!id || !ID_PATTERN.test(id)) return fail('id');
  const name = text(manifest.name, 80);
  if (!name) return fail('name');
  const description = text(manifest.description, 400);
  if (!description) return fail('description');

  const prompt = text(manifest.prompt, MAX_PROMPT_CHARS);
  if (!prompt) return fail('prompt');
  if (SECRET_HINT_PATTERN.test(prompt)) return fail('prompt.secretLike');

  const triggers = normalizeStringList(manifest.triggers, {
    field: 'triggers', maxItems: MAX_TRIGGERS, maxLength: 80, lowercase: true
  });
  if (!triggers.ok) return triggers;

  const tools = normalizeStringList(manifest.allowedTools, {
    field: 'allowedTools', maxItems: MAX_TOOLS, maxLength: 120, pattern: TOOL_PATTERN
  });
  if (!tools.ok) return tools;
  for (const tool of tools.items) {
    if (FORBIDDEN_SKILL_TOOLS.includes(tool)) return fail(`allowedTools.forbidden:${tool}`);
  }

  const args = normalizeArguments(manifest.arguments);
  if (!args.ok) return args;

  const execution = manifest.execution === undefined ? 'inline' : manifest.execution;
  if (!SKILL_EXECUTIONS.includes(execution)) return fail('execution');

  let model = null;
  if (manifest.model !== undefined) {
    model = text(manifest.model, 120);
    if (!model || !MODEL_PATTERN.test(model)) return fail('model');
  }

  let projectScope = null;
  if (source === 'project') {
    projectScope = text(manifest.projectScope, 120);
    if (!projectScope) return fail('projectScope');
    if (!Array.isArray(allowedProjectScopes) || !allowedProjectScopes.includes(projectScope)) {
      return fail('projectScope.notAllowed');
    }
  } else if (manifest.projectScope !== undefined) {
    return fail('projectScope.unexpected');
  }

  return {
    ok: true,
    skill: Object.freeze({
      id, name, description, source, execution, model, projectScope, prompt,
      triggers: Object.freeze(triggers.items),
      allowedTools: Object.freeze(tools.items),
      arguments: Object.freeze(args.items)
    })
  };
}

export const SKILL_MANIFEST_LIMITS = Object.freeze({
  sources: SKILL_SOURCES,
  executions: SKILL_EXECUTIONS,
  argumentTypes: ARGUMENT_TYPES,
  maxPromptChars: MAX_PROMPT_CHARS,
  forbiddenTools: FORBIDDEN_SKILL_TOOLS
});
