import { APPROVAL_ONLY_TOOLS, NEVER_AGENT_TOOLS } from './agent-runtime.mjs';

const MANIFEST_FIELDS = new Set(['id', 'name', 'description', 'execution', 'triggers', 'allowedTools', 'arguments', 'model', 'prompt']);
const ARGUMENT_FIELDS = new Set(['name', 'type', 'required', 'maxLength']);
const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const TOOL_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,119}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const EXECUTION_MODES = new Set(['inline', 'fork']);
const ARGUMENT_TYPES = new Set(['string', 'number', 'boolean']);
const CREDENTIAL_PATTERN = /\b(api[_-]?key|secret|password|passwd|token|bearer|private[_-]?key|client[_-]?secret)\b\s*[:=]\s*\S/i;
const FORBIDDEN_SKILL_TOOLS = new Set([...NEVER_AGENT_TOOLS, ...APPROVAL_ONLY_TOOLS]);

export const SKILL_LIMITS = Object.freeze({
  maxNameLength: 80, maxDescriptionLength: 400, maxTriggers: 16, maxTriggerLength: 60,
  maxAllowedTools: 12, maxArguments: 8, maxPromptLength: 20_000, maxArgumentLength: 4_000
});

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function plainObject(value, code) {
  if (!value || Array.isArray(value) || typeof value !== 'object') fail(code);
  return value;
}

function cleanText(value, maxLength, code) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || /[\0\r]/.test(text)) fail(code);
  return text;
}

// Sıralı, benzersiz ve sınırlı liste; her giriş normalize edilerek doğrulanır.
function uniqueList(value, max, code, normalize) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > max) fail(code);
  const seen = new Set();
  for (const item of value) {
    const entry = normalize(item);
    if (seen.has(entry)) fail(code);
    seen.add(entry);
  }
  return Object.freeze([...seen]);
}

function normalizeTrigger(value) {
  const trigger = cleanText(value, SKILL_LIMITS.maxTriggerLength, 'INVALID_SKILL_TRIGGERS').toLowerCase();
  if (trigger.length < 2) fail('INVALID_SKILL_TRIGGERS');
  return trigger;
}

// Skill kendi tool yetkisini yükseltemez: yasaklı ve onaya bağlı araçlar manifest düzeyinde reddedilir.
function normalizeTool(value) {
  const tool = typeof value === 'string' ? value.trim() : '';
  if (!TOOL_PATTERN.test(tool)) fail('INVALID_SKILL_ALLOWED_TOOLS');
  if (FORBIDDEN_SKILL_TOOLS.has(tool)) fail('SKILL_TOOL_ESCALATION_DENIED');
  return tool;
}

function normalizeArgumentSpec(spec, seen) {
  plainObject(spec, 'INVALID_SKILL_ARGUMENTS');
  for (const field of Object.keys(spec)) if (!ARGUMENT_FIELDS.has(field)) fail('INVALID_SKILL_ARGUMENT_FIELD');
  const name = typeof spec.name === 'string' ? spec.name.trim() : '';
  if (!ARGUMENT_NAME_PATTERN.test(name) || seen.has(name)) fail('INVALID_SKILL_ARGUMENTS');
  if (!ARGUMENT_TYPES.has(spec.type)) fail('INVALID_SKILL_ARGUMENTS');
  if (spec.required !== undefined && typeof spec.required !== 'boolean') fail('INVALID_SKILL_ARGUMENTS');
  let maxLength = SKILL_LIMITS.maxArgumentLength;
  if (spec.maxLength !== undefined) {
    if (spec.type !== 'string') fail('INVALID_SKILL_ARGUMENTS');
    if (!Number.isInteger(spec.maxLength) || spec.maxLength < 1 || spec.maxLength > maxLength) fail('INVALID_SKILL_ARGUMENTS');
    maxLength = spec.maxLength;
  }
  seen.add(name);
  return Object.freeze({ name, type: spec.type, required: spec.required === true, maxLength });
}

function normalizeArguments(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > SKILL_LIMITS.maxArguments) fail('INVALID_SKILL_ARGUMENTS');
  const seen = new Set();
  return Object.freeze(value.map((spec) => normalizeArgumentSpec(spec, seen)));
}

// Skill prompt'u credential taşıyamaz.
function normalizePrompt(value) {
  if (typeof value !== 'string') fail('INVALID_SKILL_PROMPT');
  const prompt = value.trim();
  if (!prompt || prompt.length > SKILL_LIMITS.maxPromptLength || prompt.includes('\0')) fail('INVALID_SKILL_PROMPT');
  if (CREDENTIAL_PATTERN.test(prompt)) fail('SKILL_PROMPT_CREDENTIAL_DENIED');
  return prompt;
}

function normalizeModel(value) {
  if (value === undefined || value === null) return null;
  const model = typeof value === 'string' ? value.trim() : '';
  if (!MODEL_PATTERN.test(model)) fail('INVALID_SKILL_MODEL');
  return model;
}

export function normalizeSkillManifest(input) {
  plainObject(input, 'INVALID_SKILL_MANIFEST');
  for (const field of Object.keys(input)) if (!MANIFEST_FIELDS.has(field)) fail('INVALID_SKILL_MANIFEST_FIELD');
  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!ID_PATTERN.test(id)) fail('INVALID_SKILL_ID');
  if (!EXECUTION_MODES.has(input.execution)) fail('INVALID_SKILL_EXECUTION');

  return Object.freeze({
    id,
    name: cleanText(input.name, SKILL_LIMITS.maxNameLength, 'INVALID_SKILL_NAME'),
    description: cleanText(input.description, SKILL_LIMITS.maxDescriptionLength, 'INVALID_SKILL_DESCRIPTION'),
    execution: input.execution,
    triggers: uniqueList(input.triggers, SKILL_LIMITS.maxTriggers, 'INVALID_SKILL_TRIGGERS', normalizeTrigger),
    allowedTools: uniqueList(input.allowedTools, SKILL_LIMITS.maxAllowedTools, 'INVALID_SKILL_ALLOWED_TOOLS', normalizeTool),
    arguments: normalizeArguments(input.arguments),
    model: normalizeModel(input.model),
    prompt: normalizePrompt(input.prompt)
  });
}

export function normalizeSkillArguments(skill, input = {}) {
  plainObject(skill, 'INVALID_SKILL_MANIFEST');
  const provided = plainObject(input, 'INVALID_SKILL_ARGUMENT_VALUES');
  const specs = Array.isArray(skill.arguments) ? skill.arguments : [];
  const declared = new Set(specs.map((spec) => spec.name));
  for (const field of Object.keys(provided)) if (!declared.has(field)) fail('UNDECLARED_SKILL_ARGUMENT');

  const values = {};
  for (const spec of specs) {
    const value = provided[spec.name];
    if (value === undefined || value === null) {
      if (spec.required) fail('MISSING_SKILL_ARGUMENT');
      continue;
    }
    if (spec.type === 'string') {
      const text = typeof value === 'string' ? value.trim() : '';
      if (!text || text.length > spec.maxLength || text.includes('\0')) fail('INVALID_SKILL_ARGUMENT_VALUE');
      values[spec.name] = text;
    } else if (spec.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) fail('INVALID_SKILL_ARGUMENT_VALUE');
      values[spec.name] = value;
    } else {
      if (typeof value !== 'boolean') fail('INVALID_SKILL_ARGUMENT_VALUE');
      values[spec.name] = value;
    }
  }
  return Object.freeze(values);
}
