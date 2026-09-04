const NAME_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const TRIGGER_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,63}$/u;
const TOOL_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._/-]{0,119}$/i;
const SCOPE_PATTERN = /^[a-z0-9][a-z0-9._/-]{0,119}$/i;
const ARGUMENT_TYPES = new Set(['string', 'number', 'boolean']);

const ALLOWED_KEYS = new Set([
  'name',
  'description',
  'triggers',
  'allowedTools',
  'arguments',
  'model',
  'execution',
  'executionAgentId',
  'prompt',
  'projectScope'
]);

const NEVER_SKILL_TOOLS = new Set(['secret.read', 'repo.delete']);
const APPROVAL_ONLY_TOOLS = new Set(['external.write', 'external.send', 'repo.merge', 'repo.write_branch']);

const CREDENTIAL_PATTERNS = [
  /sk-[a-z0-9]{16,}/i,
  /gh[pousr]_[a-z0-9]{16,}/i,
  /github_pat_[a-z0-9_]{16,}/i,
  /xox[abprs]-[a-z0-9-]{10,}/i,
  /AKIA[0-9A-Z]{12,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bbearer\s+[a-z0-9._-]{16,}/i,
  /\b(api[_-]?key|access[_-]?token|client[_-]?secret|password|passwd)\b\s*[:=]\s*\S{8,}/i,
  /\bprocess\.env\.[A-Z0-9_]+/
];

export const SKILL_SOURCES = Object.freeze(['builtin', 'user', 'project']);
export const SKILL_SOURCE_PRECEDENCE = Object.freeze({ builtin: 0, user: 1, project: 2 });
export const SKILL_EXECUTION_MODES = Object.freeze(['inline', 'fork']);

function invalid(field) {
  return { ok: false, error: `INVALID_SKILL:${field}` };
}

function cleanText(value, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && text.length <= maxLength ? text : null;
}

function containsCredential(text) {
  return CREDENTIAL_PATTERNS.some((pattern) => pattern.test(text));
}

function normalizeTriggers(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 12) return null;
  const triggers = [];
  for (const item of value) {
    const trigger = cleanText(item, 64);
    if (!trigger || !TRIGGER_PATTERN.test(trigger)) return null;
    const normalized = trigger.toLocaleLowerCase('tr');
    if (triggers.includes(normalized)) return null;
    triggers.push(normalized);
  }
  return triggers;
}

function normalizeTools(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 12) return null;
  const tools = [];
  for (const item of value) {
    const tool = cleanText(item, 120);
    if (!tool || !TOOL_PATTERN.test(tool)) return null;
    if (NEVER_SKILL_TOOLS.has(tool) || APPROVAL_ONLY_TOOLS.has(tool)) return null;
    if (tools.includes(tool)) return null;
    tools.push(tool);
  }
  return tools;
}

function normalizeArguments(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 8) return null;
  const args = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const name = cleanText(item.name, 64);
    if (!name || !NAME_PATTERN.test(name)) return null;
    if (args.some((existing) => existing.name === name)) return null;
    if (!ARGUMENT_TYPES.has(item.type)) return null;
    if (item.required !== undefined && typeof item.required !== 'boolean') return null;
    const description = cleanText(item.description, 200);
    if (item.description !== undefined && !description) return null;
    args.push(Object.freeze({
      name,
      type: item.type,
      required: item.required === true,
      description: description || ''
    }));
  }
  return args;
}

export function normalizeSkillManifest(input, { source, allowedProjectScopes = [] } = {}) {
  if (!SKILL_SOURCES.includes(source)) return invalid('source');
  if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid('manifest');

  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) return invalid(`unknownField:${key}`);
  }

  const name = cleanText(input.name, 64);
  if (!name || !NAME_PATTERN.test(name)) return invalid('name');

  const description = cleanText(input.description, 500);
  if (!description) return invalid('description');

  const triggers = normalizeTriggers(input.triggers);
  if (!triggers) return invalid('triggers');

  const allowedTools = normalizeTools(input.allowedTools);
  if (!allowedTools) return invalid('allowedTools');

  const args = normalizeArguments(input.arguments);
  if (!args) return invalid('arguments');

  let model = '';
  if (input.model !== undefined) {
    model = cleanText(input.model, 120) || '';
    if (!model || !MODEL_PATTERN.test(model)) return invalid('model');
  }

  const execution = typeof input.execution === 'string' ? input.execution.trim() : 'inline';
  if (!SKILL_EXECUTION_MODES.includes(execution)) return invalid('execution');

  let executionAgentId = '';
  if (execution === 'fork') {
    executionAgentId = cleanText(input.executionAgentId, 64) || '';
    if (!executionAgentId || !NAME_PATTERN.test(executionAgentId)) return invalid('executionAgentId');
  } else if (input.executionAgentId !== undefined) {
    return invalid('executionAgentId');
  }

  const prompt = cleanText(input.prompt, 8000);
  if (!prompt) return invalid('prompt');
  if (containsCredential(prompt) || containsCredential(description)) return invalid('credentialInPrompt');

  let projectScope = '';
  if (source === 'project') {
    projectScope = cleanText(input.projectScope, 120) || '';
    if (!projectScope || !SCOPE_PATTERN.test(projectScope)) return invalid('projectScope');
    if (!allowedProjectScopes.includes(projectScope)) return invalid('projectScopeNotAllowed');
  } else if (input.projectScope !== undefined) {
    return invalid('projectScope');
  }

  return {
    ok: true,
    skill: Object.freeze({
      name,
      description,
      source,
      precedence: SKILL_SOURCE_PRECEDENCE[source],
      triggers: Object.freeze(triggers),
      allowedTools: Object.freeze(allowedTools),
      arguments: Object.freeze(args),
      model,
      execution,
      executionAgentId,
      prompt,
      projectScope
    })
  };
}
