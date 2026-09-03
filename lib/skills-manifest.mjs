const SKILL_SOURCES = new Set(['builtin', 'user', 'project']);
const EXECUTION_MODES = new Set(['inline', 'fork']);
const ARGUMENT_TYPES = new Set(['string', 'number', 'boolean']);
const MANIFEST_FIELDS = new Set([
  'id', 'name', 'description', 'source', 'projectScope',
  'triggers', 'allowedTools', 'arguments', 'model', 'execution'
]);
const ARGUMENT_FIELDS = new Set(['name', 'type', 'required', 'description']);

const SKILL_ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const TOOL_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-zA-Z0-9_]{0,39}$/;
const MODEL_PATTERN = /^[a-z0-9][a-zA-Z0-9._/-]{2,120}$/;
const PROJECT_SCOPE_PATTERN = /^[a-z0-9][a-zA-Z0-9._/-]{0,120}$/;
const CREDENTIAL_PATTERN = /(api[_-]?key|secret|token|password|passwd|bearer)\s*[:=]\s*\S/i;

const NEVER_SKILL_TOOLS = new Set(['secret.read', 'repo.delete']);
const MAX_TRIGGERS = 12;
const MAX_TOOLS = 16;
const MAX_ARGUMENTS = 8;

function text(value, label, maxLength) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || result.length > maxLength) throw new Error(`INVALID_SKILL_MANIFEST:${label}`);
  if (CREDENTIAL_PATTERN.test(result)) throw new Error(`SKILL_MANIFEST_CREDENTIAL_NOT_ALLOWED:${label}`);
  return result;
}

function requireExactFields(input, allowed, label) {
  if (!input || Array.isArray(input) || typeof input !== 'object') {
    throw new Error(`INVALID_SKILL_MANIFEST:${label}`);
  }
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new Error(`INVALID_SKILL_MANIFEST:${label}.field:${key}`);
  }
}

function normalizeTriggers(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_TRIGGERS) {
    throw new Error('INVALID_SKILL_MANIFEST:triggers');
  }
  const triggers = value.map((item) => text(item, 'triggers.item', 200).toLowerCase());
  if (new Set(triggers).size !== triggers.length) {
    throw new Error('INVALID_SKILL_MANIFEST:triggers.duplicate');
  }
  return triggers;
}

function normalizeAllowedTools(value) {
  if (!Array.isArray(value) || value.length > MAX_TOOLS) {
    throw new Error('INVALID_SKILL_MANIFEST:allowedTools');
  }
  const tools = [];
  for (const item of value) {
    const tool = typeof item === 'string' ? item.trim() : '';
    if (!TOOL_PATTERN.test(tool)) throw new Error('INVALID_SKILL_MANIFEST:allowedTools.tool');
    if (NEVER_SKILL_TOOLS.has(tool)) {
      throw new Error(`SKILL_TOOL_FORBIDDEN:${tool}`);
    }
    if (tools.includes(tool)) throw new Error(`INVALID_SKILL_MANIFEST:allowedTools.duplicate:${tool}`);
    tools.push(tool);
  }
  return tools;
}

function normalizeArgument(input) {
  requireExactFields(input, ARGUMENT_FIELDS, 'arguments.item');
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!ARGUMENT_NAME_PATTERN.test(name)) throw new Error('INVALID_SKILL_MANIFEST:arguments.name');
  const type = typeof input.type === 'string' ? input.type.trim() : '';
  if (!ARGUMENT_TYPES.has(type)) throw new Error('INVALID_SKILL_MANIFEST:arguments.type');
  if (typeof input.required !== 'boolean') throw new Error('INVALID_SKILL_MANIFEST:arguments.required');
  return {
    name,
    type,
    required: input.required,
    description: text(input.description, 'arguments.description', 300)
  };
}

function normalizeArguments(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > MAX_ARGUMENTS) {
    throw new Error('INVALID_SKILL_MANIFEST:arguments');
  }
  const args = value.map(normalizeArgument);
  const names = args.map((argument) => argument.name);
  if (new Set(names).size !== names.length) {
    throw new Error('INVALID_SKILL_MANIFEST:arguments.duplicate');
  }
  return args;
}

function normalizeProjectScope(value, source) {
  if (source !== 'project') {
    if (value != null) throw new Error('INVALID_SKILL_MANIFEST:projectScope.notAllowed');
    return null;
  }
  const scope = typeof value === 'string' ? value.trim() : '';
  if (!PROJECT_SCOPE_PATTERN.test(scope)) throw new Error('INVALID_SKILL_MANIFEST:projectScope');
  return scope;
}

export function normalizeSkillManifest(input) {
  try {
    requireExactFields(input, MANIFEST_FIELDS, 'manifest');

    const id = typeof input.id === 'string' ? input.id.trim() : '';
    if (!SKILL_ID_PATTERN.test(id)) throw new Error('INVALID_SKILL_MANIFEST:id');

    const source = typeof input.source === 'string' ? input.source.trim() : '';
    if (!SKILL_SOURCES.has(source)) throw new Error('INVALID_SKILL_MANIFEST:source');

    const execution = typeof input.execution === 'string' ? input.execution.trim() : '';
    if (!EXECUTION_MODES.has(execution)) throw new Error('INVALID_SKILL_MANIFEST:execution');

    const model = input.model == null ? null : text(input.model, 'model', 130);
    if (model !== null && !MODEL_PATTERN.test(model)) throw new Error('INVALID_SKILL_MANIFEST:model');
    if (model !== null && execution !== 'fork') {
      throw new Error('SKILL_INLINE_MODEL_OVERRIDE_NOT_ALLOWED');
    }

    return {
      ok: true,
      skill: {
        id,
        name: text(input.name, 'name', 80),
        description: text(input.description, 'description', 500),
        source,
        projectScope: normalizeProjectScope(input.projectScope, source),
        triggers: normalizeTriggers(input.triggers),
        allowedTools: normalizeAllowedTools(input.allowedTools),
        arguments: normalizeArguments(input.arguments),
        model,
        execution
      }
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export const SKILL_MANIFEST_CONTRACT = Object.freeze({
  sources: Object.freeze([...SKILL_SOURCES]),
  executionModes: Object.freeze([...EXECUTION_MODES]),
  argumentTypes: Object.freeze([...ARGUMENT_TYPES]),
  forbiddenTools: Object.freeze([...NEVER_SKILL_TOOLS]),
  maxTriggers: MAX_TRIGGERS,
  maxAllowedTools: MAX_TOOLS,
  maxArguments: MAX_ARGUMENTS
});
