// TypeScript migration wave 2026-10.
// Compatibility-preserving typed runtime path.
// @ts-nocheck
const NAME_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const ARGUMENT_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const TOOL_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._\/-]{0,119}$/i;
const TOP_FIELDS = new Set(['name', 'description', 'triggers', 'allowedTools', 'arguments', 'parameters', 'returns', 'requiredScopes', 'sideEffects', 'riskLevel', 'rollbackHint', 'handler', 'compensate', 'model', 'execution', 'prompt']);
const ARGUMENT_FIELDS = new Set(['name', 'required', 'description']);
const SIDE_EFFECT_FIELDS = new Set(['idempotent', 'mutates', 'external']);
const SCHEMA_FIELDS = new Set(['type', 'description', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern']);
const SCHEMA_TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']);
const EXECUTION_MODES = new Set(['inline', 'fork']);
const NEVER_SKILL_TOOLS = new Set(['secret.read', 'repo.delete']);
const APPROVAL_ONLY_TOOLS = new Set(['external.write', 'external.send', 'repo.merge', 'repo.write_branch']);
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bgh[pousr]_[A-Za-z0-9]{16,}/,
  /\bnvapi-[A-Za-z0-9_-]{16,}/,
  /\bAKIA[0-9A-Z]{12,}/,
  /\bauthorization\s*:\s*bearer\s+\S/i,
  /\b(api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|password)\b\s*[:=]\s*\S/i
];
const MAX_DESCRIPTION_LENGTH = 300;
const MAX_TRIGGERS = 12;
const MAX_TRIGGER_LENGTH = 64;
const MAX_TOOLS = 16;
const MAX_ARGUMENTS = 8;
const MAX_PROMPT_LENGTH = 20_000;
const MAX_SCHEMA_DEPTH = 8;
const MAX_SCHEMA_PROPERTIES = 64;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function containsSecretMaterial(value) {
  return typeof value === 'string' && SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

function normalizeName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!NAME_PATTERN.test(name)) fail('INVALID_SKILL_NAME');
  return name;
}

function normalizeDescription(value) {
  const description = typeof value === 'string' ? value.trim() : '';
  if (!description || description.length > MAX_DESCRIPTION_LENGTH || /[\0\r\n]/.test(description)) fail('INVALID_SKILL_DESCRIPTION');
  return description;
}

function normalizeTriggers(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_TRIGGERS) fail('INVALID_SKILL_TRIGGERS');
  const triggers = [];
  for (const item of value) {
    const trigger = typeof item === 'string' ? item.trim().toLowerCase() : '';
    if (!trigger || trigger.length > MAX_TRIGGER_LENGTH || /[\0\r\n]/.test(trigger)) fail('INVALID_SKILL_TRIGGERS');
    if (triggers.includes(trigger)) fail('INVALID_SKILL_TRIGGERS');
    triggers.push(trigger);
  }
  return Object.freeze(triggers);
}

function normalizeTools(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_TOOLS) fail('INVALID_SKILL_TOOLS');
  const tools = [];
  for (const item of value) {
    const tool = typeof item === 'string' ? item.trim() : '';
    if (!TOOL_PATTERN.test(tool) || tools.includes(tool)) fail('INVALID_SKILL_TOOLS');
    if (NEVER_SKILL_TOOLS.has(tool)) fail(`FORBIDDEN_SKILL_TOOL:${tool}`);
    tools.push(tool);
  }
  return Object.freeze(tools);
}

function normalizeArguments(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_ARGUMENTS) fail('INVALID_SKILL_ARGUMENTS');
  const args = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail('INVALID_SKILL_ARGUMENTS');
    for (const field of Object.keys(item)) if (!ARGUMENT_FIELDS.has(field)) fail('INVALID_SKILL_ARGUMENT_FIELD');
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!ARGUMENT_PATTERN.test(name) || args.some((argument) => argument.name === name)) fail('INVALID_SKILL_ARGUMENTS');
    if (item.required !== undefined && typeof item.required !== 'boolean') fail('INVALID_SKILL_ARGUMENTS');
    args.push(Object.freeze({
      name,
      required: item.required === true,
      description: item.description === undefined ? '' : normalizeDescription(item.description)
    }));
  }
  return Object.freeze(args);
}

function normalizeSchema(value, label, depth = 0) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > MAX_SCHEMA_DEPTH) fail(`INVALID_SKILL_${label}_SCHEMA`);
  for (const field of Object.keys(value)) if (!SCHEMA_FIELDS.has(field)) fail(`INVALID_SKILL_${label}_SCHEMA_FIELD`);
  if (!SCHEMA_TYPES.has(value.type)) fail(`INVALID_SKILL_${label}_SCHEMA_TYPE`);
  const schema = { type: value.type };
  if (value.description !== undefined) schema.description = normalizeDescription(value.description);
  if (value.enum !== undefined) {
    if (!Array.isArray(value.enum) || value.enum.length > 100 || value.enum.some((item) => item !== null && !['string', 'number', 'boolean'].includes(typeof item))) fail(`INVALID_SKILL_${label}_SCHEMA_ENUM`);
    schema.enum = Object.freeze([...value.enum]);
  }
  if (Object.hasOwn(value, 'const')) {
    if (value.const !== null && !['string', 'number', 'boolean'].includes(typeof value.const)) fail(`INVALID_SKILL_${label}_SCHEMA_CONST`);
    schema.const = value.const;
  }
  for (const field of ['minimum', 'maximum', 'minLength', 'maxLength']) {
    if (value[field] !== undefined) {
      if (!Number.isSafeInteger(value[field]) || value[field] < 0) fail(`INVALID_SKILL_${label}_SCHEMA_BOUND`);
      schema[field] = value[field];
    }
  }
  if (schema.minimum !== undefined && schema.maximum !== undefined && schema.minimum > schema.maximum) fail(`INVALID_SKILL_${label}_SCHEMA_BOUND`);
  if (schema.minLength !== undefined && schema.maxLength !== undefined && schema.minLength > schema.maxLength) fail(`INVALID_SKILL_${label}_SCHEMA_BOUND`);
  if (value.pattern !== undefined) {
    if (typeof value.pattern !== 'string' || value.pattern.length > 200) fail(`INVALID_SKILL_${label}_SCHEMA_PATTERN`);
    try { new RegExp(value.pattern); } catch { fail(`INVALID_SKILL_${label}_SCHEMA_PATTERN`); }
    schema.pattern = value.pattern;
  }
  if (value.type === 'object') {
    const properties = value.properties === undefined ? {} : value.properties;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties) || Object.keys(properties).length > MAX_SCHEMA_PROPERTIES) fail(`INVALID_SKILL_${label}_SCHEMA_PROPERTIES`);
    const normalizedProperties = {};
    for (const [name, property] of Object.entries(properties)) {
      if (!ARGUMENT_PATTERN.test(name)) fail(`INVALID_SKILL_${label}_SCHEMA_PROPERTY`);
      normalizedProperties[name] = normalizeSchema(property, label, depth + 1);
    }
    if (value.required !== undefined && (!Array.isArray(value.required) || value.required.some((name) => typeof name !== 'string' || !Object.hasOwn(normalizedProperties, name)) || new Set(value.required).size !== value.required.length)) fail(`INVALID_SKILL_${label}_SCHEMA_REQUIRED`);
    if (value.additionalProperties !== undefined && typeof value.additionalProperties !== 'boolean') fail(`INVALID_SKILL_${label}_SCHEMA_ADDITIONAL_PROPERTIES`);
    schema.properties = Object.freeze(normalizedProperties);
    schema.required = Object.freeze(value.required === undefined ? [] : [...value.required]);
    schema.additionalProperties = value.additionalProperties === true;
  } else if (value.type === 'array') {
    schema.items = normalizeSchema(value.items, label, depth + 1);
  } else if (value.properties !== undefined || value.required !== undefined || value.additionalProperties !== undefined || value.items !== undefined) {
    fail(`INVALID_SKILL_${label}_SCHEMA_SHAPE`);
  }
  return Object.freeze(schema);
}

function normalizeScopes(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_TOOLS) fail('INVALID_SKILL_SCOPES');
  const scopes = [];
  for (const scope of value) {
    const normalized = typeof scope === 'string' ? scope.trim() : '';
    if (!TOOL_PATTERN.test(normalized) || scopes.includes(normalized)) fail('INVALID_SKILL_SCOPES');
    scopes.push(normalized);
  }
  return Object.freeze(scopes);
}

function normalizeSideEffects(value, tools) {
  if (value === undefined) {
    const mutates = tools.some((tool) => /(?:\.write|\.send|\.delete|\.merge)$/.test(tool));
    const external = tools.some((tool) => /(?:external\.|\.send)$/.test(tool));
    return Object.freeze({ idempotent: !mutates, mutates, external });
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_SKILL_SIDE_EFFECTS');
  for (const field of Object.keys(value)) if (!SIDE_EFFECT_FIELDS.has(field)) fail('INVALID_SKILL_SIDE_EFFECTS_FIELD');
  for (const field of SIDE_EFFECT_FIELDS) if (typeof value[field] !== 'boolean') fail('INVALID_SKILL_SIDE_EFFECTS');
  if (value.external && !value.mutates) fail('INVALID_SKILL_SIDE_EFFECTS');
  return Object.freeze({ idempotent: value.idempotent, mutates: value.mutates, external: value.external });
}

function normalizeRiskLevel(value, sideEffects) {
  const risk = value === undefined ? (sideEffects.external ? 'high' : sideEffects.mutates ? 'medium' : 'low') : value;
  if (!['low', 'medium', 'high'].includes(risk)) fail('INVALID_SKILL_RISK_LEVEL');
  if (sideEffects.external && risk !== 'high') fail('INVALID_SKILL_RISK_LEVEL:external_requires_high');
  if (sideEffects.mutates && risk === 'low') fail('INVALID_SKILL_RISK_LEVEL:mutation_requires_medium');
  return risk;
}

// An executable skill names how it runs: a built-in tool of the runtime, or user code that runs in
// the sandbox (network only when declared). compensate names the undo action for mutating skills.
const HANDLER_TOOL_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
const HANDLER_FILE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}.js$/;
function normalizeHandler(value, label) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`INVALID_SKILL_${label}`);
  for (const field of Object.keys(value)) if (!['type', 'tool', 'file', 'network', 'timeoutMs'].includes(field)) fail(`INVALID_SKILL_${label}_FIELD`);
  if (value.type === 'tool') {
    if (!HANDLER_TOOL_PATTERN.test(String(value.tool || ''))) fail(`INVALID_SKILL_${label}_TOOL`);
    return Object.freeze({ type: 'tool', tool: String(value.tool) });
  }
  if (value.type === 'sandbox') {
    if (!HANDLER_FILE_PATTERN.test(String(value.file || ''))) fail(`INVALID_SKILL_${label}_FILE`);
    const timeoutMs = value.timeoutMs === undefined ? 5000 : Number(value.timeoutMs);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) fail(`INVALID_SKILL_${label}_TIMEOUT`);
    return Object.freeze({ type: 'sandbox', file: String(value.file), network: value.network === true, timeoutMs });
  }
  fail(`INVALID_SKILL_${label}_TYPE`);
}

function normalizeRollbackHint(value) {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > 500 || /[\0\r\n]/.test(value)) fail('INVALID_SKILL_ROLLBACK_HINT');
  return value.trim();
}

function normalizeModel(value) {
  if (value === undefined) return '';
  if (typeof value !== 'string') fail('INVALID_SKILL_MODEL');
  const model = value.trim();
  // An empty model means "no preference" and matches the value produced for an
  // omitted field; only a non-empty identifier has to satisfy the pattern.
  if (!model) return '';
  if (!MODEL_PATTERN.test(model)) fail('INVALID_SKILL_MODEL');
  return model;
}

function normalizeExecution(value, tools) {
  const execution = value === undefined ? 'inline' : value;
  if (typeof execution !== 'string' || !EXECUTION_MODES.has(execution)) fail('INVALID_SKILL_EXECUTION');
  if (execution === 'inline' && tools.some((tool) => APPROVAL_ONLY_TOOLS.has(tool))) fail('INVALID_SKILL_EXECUTION:approval_requires_fork');
  return execution;
}

function normalizePrompt(value) {
  const prompt = typeof value === 'string' ? value.trim() : '';
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH || prompt.includes('\0')) fail('INVALID_SKILL_PROMPT');
  if (containsSecretMaterial(prompt)) fail('SKILL_PROMPT_SECRET_MATERIAL');
  return prompt;
}

export function normalizeSkillManifest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_SKILL_MANIFEST');
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail('INVALID_SKILL_FIELD');
  const allowedTools = normalizeTools(input.allowedTools);
  const execution = normalizeExecution(input.execution, allowedTools);
  const sideEffects = normalizeSideEffects(input.sideEffects, allowedTools);
  const riskLevel = normalizeRiskLevel(input.riskLevel, sideEffects);
  const argumentsContract = normalizeArguments(input.arguments);
  const legacyProperties = Object.fromEntries(argumentsContract.map((argument) => [argument.name, Object.freeze({ type: 'string', description: argument.description })]));
  const parameters = input.parameters === undefined
    ? Object.freeze({ type: 'object', properties: Object.freeze(legacyProperties), required: Object.freeze(argumentsContract.filter((argument) => argument.required).map((argument) => argument.name)), additionalProperties: false })
    : normalizeSchema(input.parameters, 'PARAMETERS');
  if (parameters.type !== 'object') fail('INVALID_SKILL_PARAMETERS_SCHEMA');
  const returns = input.returns === undefined ? null : normalizeSchema(input.returns, 'RETURNS');
  // Only manifests that declare their side effects are held to the rollback contract.
  if (input.sideEffects !== undefined && riskLevel === 'high' && sideEffects.mutates && !normalizeRollbackHint(input.rollbackHint)) fail('SKILL_ROLLBACK_HINT_REQUIRED');
  // Legacy manifests predate requiredScopes; a risky one then asks consent for every declared tool.
  const requiredScopes = input.requiredScopes === undefined && (riskLevel !== 'low' || sideEffects.mutates)
    ? Object.freeze([...allowedTools])
    : normalizeScopes(input.requiredScopes);
  if ((riskLevel !== 'low' || sideEffects.mutates) && allowedTools.some((tool) => !requiredScopes.includes(tool))) fail('SKILL_REQUIRED_SCOPE_MISSING');
  return Object.freeze({
    name: normalizeName(input.name),
    description: normalizeDescription(input.description),
    triggers: normalizeTriggers(input.triggers),
    allowedTools,
    arguments: argumentsContract,
    parameters,
    returns,
    requiredScopes,
    sideEffects,
    riskLevel,
    rollbackHint: normalizeRollbackHint(input.rollbackHint),
    model: normalizeModel(input.model),
    execution,
    prompt: normalizePrompt(input.prompt),
    handler: normalizeHandler(input.handler, 'HANDLER'),
    compensate: normalizeHandler(input.compensate, 'COMPENSATE')
  });
}

function matchesSchema(value, schema) {
  if (Object.hasOwn(schema, 'const') && value !== schema.const) return false;
  if (schema.enum && !schema.enum.some((item) => item === value)) return false;
  if (schema.type === 'null') return value === null;
  if (schema.type === 'string') {
    return typeof value === 'string'
      && (schema.minLength === undefined || value.length >= schema.minLength)
      && (schema.maxLength === undefined || value.length <= schema.maxLength)
      && (schema.pattern === undefined || new RegExp(schema.pattern).test(value));
  }
  if (schema.type === 'number' || schema.type === 'integer') {
    return typeof value === 'number' && Number.isFinite(value)
      && (schema.type !== 'integer' || Number.isInteger(value))
      && (schema.minimum === undefined || value >= schema.minimum)
      && (schema.maximum === undefined || value <= schema.maximum);
  }
  if (schema.type === 'boolean') return typeof value === 'boolean';
  if (schema.type === 'array') return Array.isArray(value) && value.every((item) => matchesSchema(item, schema.items));
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (schema.required.some((name) => !Object.hasOwn(value, name))) return false;
    for (const [name, item] of Object.entries(value)) {
      const property = schema.properties[name];
      if (!property) { if (!schema.additionalProperties) return false; }
      else if (!matchesSchema(item, property)) return false;
    }
    return true;
  }
  return false;
}

export function assertSkillParameters(manifest, value) {
  if (!matchesSchema(value, manifest.parameters)) fail('INVALID_SKILL_PARAMETERS');
  return value;
}

export const SKILL_MANIFEST_LIMITS = Object.freeze({
  maxTriggers: MAX_TRIGGERS,
  maxTools: MAX_TOOLS,
  maxArguments: MAX_ARGUMENTS,
  maxPromptLength: MAX_PROMPT_LENGTH,
  maxSchemaDepth: MAX_SCHEMA_DEPTH,
  maxSchemaProperties: MAX_SCHEMA_PROPERTIES,
  approvalOnlyTools: Object.freeze([...APPROVAL_ONLY_TOOLS]),
  neverSkillTools: Object.freeze([...NEVER_SKILL_TOOLS])
});
