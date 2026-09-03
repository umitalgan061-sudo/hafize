const TOP_FIELDS = new Set(['name', 'description', 'triggers', 'allowedTools', 'arguments', 'model', 'execution', 'prompt']);
const ARGUMENT_FIELDS = new Set(['name', 'type', 'required', 'description']);
const SOURCES = new Set(['builtin', 'user', 'project']);
const EXECUTIONS = new Set(['inline', 'fork']);
const ARGUMENT_TYPES = new Set(['string', 'number', 'boolean']);

const NAME_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._/-]{1,99}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const PROJECT_SCOPE_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

const NEVER_SKILL_PERMISSIONS = new Set(['secret.read', 'repo.delete', 'repo.merge']);
const SECRET_PATTERNS = [
  /\b(?:api[_-]?key|secret|password|passphrase|credential|private[_-]?key|access[_-]?token|refresh[_-]?token)\b\s*[:=]/i,
  /\bprocess\s*\.\s*env\b/,
  /\bAuthorization\s*:\s*Bearer\b/i,
  /\b(?:sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{16,}|nvapi-[A-Za-z0-9_-]{16,})\b/
];

export const SKILL_LIMITS = Object.freeze({
  maxDescriptionLength: 400,
  maxTriggers: 12,
  maxTriggerLength: 120,
  maxAllowedTools: 12,
  maxArguments: 8,
  maxPromptLength: 8_000
});

export const SKILL_SOURCE_TRUST = Object.freeze({ builtin: 3, user: 2, project: 1 });

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function rejectUnknownFields(input, allowed, code) {
  for (const field of Object.keys(input)) if (!allowed.has(field)) fail(code);
}

function requireText(value, { code, maxLength, pattern }) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || /[\0\r]/.test(text)) fail(code);
  if (pattern && !pattern.test(text)) fail(code);
  return text;
}

function rejectSecretLikeText(value) {
  for (const pattern of SECRET_PATTERNS) if (pattern.test(value)) fail('SKILL_SECRET_MATERIAL_FORBIDDEN');
}

function normalizeTriggers(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > SKILL_LIMITS.maxTriggers) fail('INVALID_SKILL_TRIGGERS');
  const triggers = [];
  const seen = new Set();
  for (const item of value) {
    const trigger = requireText(item, { code: 'INVALID_SKILL_TRIGGER', maxLength: SKILL_LIMITS.maxTriggerLength }).toLowerCase();
    if (trigger.includes('\n') || seen.has(trigger)) fail('INVALID_SKILL_TRIGGER');
    seen.add(trigger);
    triggers.push(trigger);
  }
  return Object.freeze(triggers);
}

function normalizeAllowedTools(value, grantedPermissions) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > SKILL_LIMITS.maxAllowedTools) fail('INVALID_SKILL_ALLOWED_TOOLS');
  const tools = [];
  const seen = new Set();
  for (const item of value) {
    const permission = requireText(item, { code: 'INVALID_SKILL_ALLOWED_TOOL', maxLength: 120, pattern: PERMISSION_PATTERN });
    if (seen.has(permission)) fail('INVALID_SKILL_ALLOWED_TOOL');
    if (NEVER_SKILL_PERMISSIONS.has(permission)) fail('SKILL_PERMISSION_FORBIDDEN');
    if (!grantedPermissions.has(permission)) fail('SKILL_TOOL_ESCALATION_FORBIDDEN');
    seen.add(permission);
    tools.push(permission);
  }
  return Object.freeze(tools);
}

function normalizeArguments(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > SKILL_LIMITS.maxArguments) fail('INVALID_SKILL_ARGUMENTS');
  const args = [];
  const seen = new Set();
  for (const item of value) {
    if (!item || Array.isArray(item) || typeof item !== 'object') fail('INVALID_SKILL_ARGUMENT');
    rejectUnknownFields(item, ARGUMENT_FIELDS, 'INVALID_SKILL_ARGUMENT_FIELD');
    const name = requireText(item.name, { code: 'INVALID_SKILL_ARGUMENT', maxLength: 40, pattern: ARGUMENT_NAME_PATTERN });
    if (seen.has(name)) fail('INVALID_SKILL_ARGUMENT');
    if (typeof item.type !== 'string' || !ARGUMENT_TYPES.has(item.type)) fail('INVALID_SKILL_ARGUMENT_TYPE');
    if (item.required != null && typeof item.required !== 'boolean') fail('INVALID_SKILL_ARGUMENT');
    const description = requireText(item.description, { code: 'INVALID_SKILL_ARGUMENT', maxLength: 200 });
    rejectSecretLikeText(description);
    seen.add(name);
    args.push(Object.freeze({ name, type: item.type, required: item.required === true, description }));
  }
  return Object.freeze(args);
}

function normalizeSource(source, projectScope, allowedProjectScopes) {
  if (typeof source !== 'string' || !SOURCES.has(source)) fail('INVALID_SKILL_SOURCE');
  if (source !== 'project') {
    if (projectScope != null) fail('INVALID_SKILL_PROJECT_SCOPE');
    return { source, projectScope: null };
  }

  const scope = requireText(projectScope, { code: 'INVALID_SKILL_PROJECT_SCOPE', maxLength: 200, pattern: PROJECT_SCOPE_PATTERN });
  const allowed = Array.isArray(allowedProjectScopes) ? allowedProjectScopes : [];
  if (!allowed.some((item) => typeof item === 'string' && item.trim() === scope)) {
    fail('SKILL_PROJECT_SCOPE_NOT_ALLOWED');
  }
  return { source, projectScope: scope };
}

function normalizeExecution(value, { source, canFork }) {
  const execution = typeof value === 'string' && value.trim() ? value.trim() : 'inline';
  if (!EXECUTIONS.has(execution)) fail('INVALID_SKILL_EXECUTION');
  if (execution === 'fork') {
    if (source === 'project') fail('SKILL_FORK_SOURCE_FORBIDDEN');
    if (canFork !== true) fail('SKILL_FORK_NOT_AUTHORIZED');
  }
  return execution;
}

function grantedPermissionsOf(agent) {
  const policy = agent?.toolPolicy;
  if (policy?.default !== 'deny') fail('SKILL_AGENT_POLICY_REQUIRED');
  const denied = new Set(Array.isArray(policy.deny) ? policy.deny : []);
  const granted = new Set();
  for (const permission of Array.isArray(policy.allow) ? policy.allow : []) {
    if (typeof permission === 'string' && !denied.has(permission)) granted.add(permission);
  }
  return granted;
}

/**
 * Bir skill manifest'ini strict olarak doğrular ve dondurulmuş bir kayda çevirir.
 * Kaynak (`source`) ve proje kapsamı manifest içeriğinden değil, çağıran taraftan gelir;
 * böylece bir manifest kendi güven düzeyini veya araç yetkisini yükseltemez.
 */
export function normalizeSkillManifest(input = {}, { source, projectScope = null, agent, allowedProjectScopes = [] } = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_SKILL_MANIFEST');
  rejectUnknownFields(input, TOP_FIELDS, 'INVALID_SKILL_MANIFEST_FIELD');

  const resolvedSource = normalizeSource(source, projectScope, allowedProjectScopes);
  const grantedPermissions = grantedPermissionsOf(agent);

  const name = requireText(input.name, { code: 'INVALID_SKILL_NAME', maxLength: 64, pattern: NAME_PATTERN });
  const description = requireText(input.description, { code: 'INVALID_SKILL_DESCRIPTION', maxLength: SKILL_LIMITS.maxDescriptionLength });
  const prompt = requireText(input.prompt, { code: 'INVALID_SKILL_PROMPT', maxLength: SKILL_LIMITS.maxPromptLength });
  for (const text of [description, prompt]) rejectSecretLikeText(text);

  const allowedTools = normalizeAllowedTools(input.allowedTools, grantedPermissions);
  const model = input.model == null ? null : requireText(input.model, { code: 'INVALID_SKILL_MODEL', maxLength: 100, pattern: MODEL_PATTERN });

  return Object.freeze({
    name,
    description,
    source: resolvedSource.source,
    projectScope: resolvedSource.projectScope,
    trust: SKILL_SOURCE_TRUST[resolvedSource.source],
    triggers: normalizeTriggers(input.triggers),
    allowedTools,
    arguments: normalizeArguments(input.arguments),
    model,
    execution: normalizeExecution(input.execution, {
      source: resolvedSource.source,
      canFork: grantedPermissions.has('agent.delegate')
    }),
    prompt
  });
}
