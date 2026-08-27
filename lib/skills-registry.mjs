const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-zA-Z0-9_]{0,39}$/;
const MODEL_PATTERN = /^[a-z0-9][a-zA-Z0-9._\/-]{0,127}$/;
const SCOPE_PATTERN = /^[a-z0-9][a-z0-9._\/-]{0,127}$/;

const TOP_FIELDS = new Set(['id', 'name', 'description', 'source', 'triggers', 'tools', 'arguments', 'model', 'execution', 'prompt', 'projectScope']);
const ARGUMENT_FIELDS = new Set(['name', 'type', 'required', 'description']);
const ARGUMENT_TYPES = new Set(['string', 'number', 'boolean']);
const EXECUTION_MODES = new Set(['inline', 'fork']);
// Lower rank wins: a less trusted source can never shadow a more trusted one.
const SOURCE_RANK = new Map([['builtin', 0], ['user', 1], ['project', 2]]);

const NEVER_SKILL_PERMISSIONS = new Set(['secret.read', 'repo.delete']);
const APPROVAL_ONLY_PERMISSIONS = new Set(['external.write', 'external.send', 'repo.merge', 'repo.write_branch']);
const SECRET_PATTERNS = [
  /process\s*\.\s*env/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bBearer\s+[A-Za-z0-9._~+\/-]{12,}/,
  /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|passwd)\b\s*[:=]/i,
  /\bsk-[A-Za-z0-9]{16,}\b/,
  /\bnvapi-[A-Za-z0-9_-]{16,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{16,}\b/,
  /\bAKIA[0-9A-Z]{12,}\b/
];

const MAX_TRIGGERS = 12;
const MAX_ARGUMENTS = 8;
const MAX_TOOLS = 12;
const MAX_PROMPT_LENGTH = 20_000;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}
function invalid(field) { fail(`INVALID_SKILL_MANIFEST:${field}`); }
function text(value, field, { min = 1, max = 512 } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < min || normalized.length > max || /[\0\r]/.test(normalized)) invalid(field);
  return normalized;
}
function strictObject(value, field, allowed) {
  if (!value || Array.isArray(value) || typeof value !== 'object') invalid(field);
  for (const key of Object.keys(value)) if (!allowed.has(key)) invalid(`${field}.${key}`);
  return value;
}
function enumValue(value, field, allowed, max = 16) {
  const normalized = text(value, field, { max });
  if (!allowed.has(normalized)) invalid(field);
  return normalized;
}
function patternSet(value, field, pattern) {
  const values = new Set();
  if (value === undefined) return values;
  if (!Array.isArray(value)) invalid(field);
  for (const item of value) {
    const normalized = typeof item === 'string' ? item.trim() : '';
    if (!pattern.test(normalized) || normalized.includes('..')) invalid(`${field}.item`);
    values.add(normalized);
  }
  return values;
}

function normalizeTriggers(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_TRIGGERS) invalid('triggers');
  const triggers = [];
  for (const item of value) {
    const trigger = text(item, 'triggers.item', { min: 2, max: 120 }).toLocaleLowerCase('tr');
    if (triggers.includes(trigger)) invalid('triggers.duplicate');
    triggers.push(trigger);
  }
  return Object.freeze(triggers);
}

function normalizeTools(value, hostPermissions) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_TOOLS) invalid('tools');
  const tools = [];
  for (const item of value) {
    const permission = typeof item === 'string' ? item.trim() : '';
    if (!PERMISSION_PATTERN.test(permission)) invalid('tools.item');
    if (tools.includes(permission)) invalid('tools.duplicate');
    if (NEVER_SKILL_PERMISSIONS.has(permission)) fail(`SKILL_PERMISSION_FORBIDDEN:${permission}`);
    if (APPROVAL_ONLY_PERMISSIONS.has(permission)) fail(`SKILL_PERMISSION_APPROVAL_ONLY:${permission}`);
    if (!hostPermissions.has(permission)) fail(`SKILL_PERMISSION_ESCALATION:${permission}`);
    tools.push(permission);
  }
  return Object.freeze(tools);
}

function normalizeArguments(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_ARGUMENTS) invalid('arguments');
  const argumentList = [];
  for (const item of value) {
    const entry = strictObject(item, 'arguments.item', ARGUMENT_FIELDS);
    const name = text(entry.name, 'arguments.name', { max: 40 });
    if (!ARGUMENT_NAME_PATTERN.test(name)) invalid('arguments.name');
    if (argumentList.some((argument) => argument.name === name)) invalid('arguments.duplicate');
    if (entry.required !== undefined && typeof entry.required !== 'boolean') invalid('arguments.required');
    argumentList.push(Object.freeze({
      name,
      type: enumValue(entry.type, 'arguments.type', ARGUMENT_TYPES),
      required: entry.required === true,
      description: entry.description === undefined ? '' : text(entry.description, 'arguments.description', { max: 240 })
    }));
  }
  return Object.freeze(argumentList);
}

function normalizePrompt(value) {
  const prompt = text(value, 'prompt', { min: 8, max: MAX_PROMPT_LENGTH });
  for (const pattern of SECRET_PATTERNS) if (pattern.test(prompt)) fail('SKILL_PROMPT_SECRET_SUSPECTED');
  return prompt;
}

function normalizeProjectScope(value, source, allowedScopes) {
  if (source !== 'project') {
    if (value !== undefined) invalid('projectScope');
    return null;
  }
  const scope = text(value, 'projectScope', { max: 128 });
  if (!SCOPE_PATTERN.test(scope) || scope.includes('..')) invalid('projectScope');
  if (!allowedScopes.has(scope)) fail(`SKILL_PROJECT_SCOPE_DENIED:${scope}`);
  return scope;
}

/**
 * Validates one skill manifest against the host agent's already granted
 * permissions. A skill may narrow what the agent can do, never widen it.
 */
export function normalizeSkillManifest(input, { hostPermissions, allowedProjectScopes } = {}) {
  const host = patternSet(hostPermissions, 'hostPermissions', PERMISSION_PATTERN);
  const scopes = patternSet(allowedProjectScopes, 'allowedProjectScopes', SCOPE_PATTERN);
  const manifest = strictObject(input, 'manifest', TOP_FIELDS);
  const id = text(manifest.id, 'id', { max: 64 });
  if (!ID_PATTERN.test(id)) invalid('id');
  const source = enumValue(manifest.source, 'source', SOURCE_RANK);
  let model = null;
  if (manifest.model !== undefined) {
    model = text(manifest.model, 'model', { max: 128 });
    if (!MODEL_PATTERN.test(model)) invalid('model');
  }

  return Object.freeze({
    id,
    name: text(manifest.name, 'name', { max: 80 }),
    description: text(manifest.description, 'description', { max: 400 }),
    source,
    execution: enumValue(manifest.execution, 'execution', EXECUTION_MODES),
    triggers: normalizeTriggers(manifest.triggers),
    tools: normalizeTools(manifest.tools, host),
    arguments: normalizeArguments(manifest.arguments),
    model,
    prompt: normalizePrompt(manifest.prompt),
    projectScope: normalizeProjectScope(manifest.projectScope, source, scopes)
  });
}

/**
 * Loads many manifests. An invalid manifest is isolated instead of taking the
 * whole registry down, and a lower trust source never shadows an id that a
 * higher trust source already owns.
 */
export function createSkillsRegistry({ manifests = [], hostPermissions = [], allowedProjectScopes = [] } = {}) {
  if (!Array.isArray(manifests)) invalid('manifests');
  const accepted = new Map();
  const rejected = [];
  const shadowed = [];

  for (const candidate of manifests) {
    let skill;
    try {
      skill = normalizeSkillManifest(candidate, { hostPermissions, allowedProjectScopes });
    } catch (error) {
      rejected.push(Object.freeze({
        id: typeof candidate?.id === 'string' ? candidate.id.slice(0, 64) : null,
        source: typeof candidate?.source === 'string' ? candidate.source.slice(0, 16) : null,
        reason: typeof error?.code === 'string' ? error.code : 'INVALID_SKILL_MANIFEST'
      }));
      continue;
    }
    const existing = accepted.get(skill.id);
    if (!existing) {
      accepted.set(skill.id, skill);
      continue;
    }
    const loser = SOURCE_RANK.get(existing.source) <= SOURCE_RANK.get(skill.source) ? skill : existing;
    shadowed.push(Object.freeze({ id: loser.id, source: loser.source }));
    if (loser === existing) accepted.set(skill.id, skill);
  }

  const list = Object.freeze([...accepted.values()]);
  return Object.freeze({
    list,
    get(skillId) {
      return accepted.get(typeof skillId === 'string' ? skillId.trim() : '') || null;
    },
    match(input) {
      const haystack = typeof input === 'string' ? input.trim().toLocaleLowerCase('tr') : '';
      if (!haystack) return [];
      return list.filter((skill) => skill.triggers.some((trigger) => haystack.includes(trigger)));
    },
    listPublic() {
      return list.map(({ id, name, description, source, execution }) => ({ id, name, description, source, execution }));
    },
    rejected: Object.freeze(rejected),
    shadowed: Object.freeze(shadowed)
  });
}

/**
 * Turns a resolved skill into an execution plan. `inline` stays in the current
 * agent turn and trace; `fork` becomes a bounded isolated run. Neither mode
 * hands the skill a permission the host agent does not still hold.
 */
export function buildSkillExecutionPlan(skill, { hostPermissions = [], traceId } = {}) {
  if (!skill || typeof skill !== 'object' || !EXECUTION_MODES.has(skill.execution)) invalid('skill');
  const host = patternSet(hostPermissions, 'hostPermissions', PERMISSION_PATTERN);
  const trace = text(traceId, 'traceId', { max: 128 });
  const permissions = [];
  for (const permission of skill.tools || []) {
    if (!host.has(permission)) fail(`SKILL_PERMISSION_ESCALATION:${permission}`);
    permissions.push(permission);
  }

  return Object.freeze({
    skillId: skill.id,
    execution: skill.execution,
    traceId: trace,
    isolated: skill.execution === 'fork',
    inheritsHostTools: false,
    permissions: Object.freeze(permissions),
    model: skill.model || null,
    prompt: skill.prompt
  });
}

export const SKILL_LIMITS = Object.freeze({
  maxTriggers: MAX_TRIGGERS,
  maxArguments: MAX_ARGUMENTS,
  maxTools: MAX_TOOLS,
  maxPromptLength: MAX_PROMPT_LENGTH
});
