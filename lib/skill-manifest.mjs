const TOP_FIELDS = new Set([
  'name', 'description', 'source', 'projectScope', 'triggers',
  'allowedTools', 'arguments', 'model', 'execution', 'instructions'
]);
const ARGUMENT_FIELDS = new Set(['name', 'description', 'required', 'maxLength']);

const NAME_PATTERN = /^[a-z][a-z0-9-]{1,47}$/;
const TOOL_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-zA-Z0-9_]{0,31}$/;
const MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,119}$/;
const SCOPE_PATTERN = /^[a-z][a-z0-9._/-]{0,79}$/;
const SOURCES = Object.freeze(['builtin', 'user', 'project']);
const EXECUTION_MODES = Object.freeze(['inline', 'fork']);
const FORBIDDEN_TOOLS = new Set(['secret.read', 'repo.delete']);
const APPROVAL_ONLY_TOOLS = new Set(['external.write', 'external.send', 'repo.merge', 'repo.write_branch']);
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bgh[pousr]_[A-Za-z0-9]{20,}/, /\bsk-[A-Za-z0-9]{16,}/,
  /\bAKIA[0-9A-Z]{16}\b/, /\bxox[baprs]-[A-Za-z0-9-]{10,}/
];

const MAX_DESCRIPTION_LENGTH = 500;
const MAX_INSTRUCTIONS_LENGTH = 20_000;
const MAX_TRIGGERS = 8;
const MAX_TRIGGER_LENGTH = 80;
const MAX_TOOLS = 12;
const MAX_ARGUMENTS = 6;
const MAX_ARGUMENT_LENGTH = 4_000;

function fail(field) {
  const error = new Error(`INVALID_SKILL_MANIFEST:${field}`);
  error.code = `INVALID_SKILL_MANIFEST:${field}`;
  throw error;
}

function requireText(value, field, maxLength) {
  if (typeof value !== 'string') fail(field);
  const text = value.trim();
  if (!text || text.length > maxLength || text.includes('\0')) fail(field);
  return text;
}

function normalizeTriggers(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_TRIGGERS) fail('triggers');
  const triggers = [];
  const seen = new Set();
  for (const item of value) {
    const trigger = requireText(item, 'triggers.item', MAX_TRIGGER_LENGTH).toLowerCase();
    if (seen.has(trigger)) fail('triggers.duplicate');
    seen.add(trigger);
    triggers.push(trigger);
  }
  return Object.freeze(triggers);
}

function normalizeAllowedTools(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_TOOLS) fail('allowedTools');
  const tools = [];
  const seen = new Set();
  for (const item of value) {
    const tool = typeof item === 'string' ? item.trim() : '';
    if (!TOOL_PATTERN.test(tool)) fail('allowedTools.item');
    if (seen.has(tool)) fail('allowedTools.duplicate');
    if (FORBIDDEN_TOOLS.has(tool)) fail(`allowedTools.forbidden:${tool}`);
    if (APPROVAL_ONLY_TOOLS.has(tool)) fail(`allowedTools.approvalRequired:${tool}`);
    seen.add(tool);
    tools.push(tool);
  }
  return Object.freeze(tools);
}

function normalizeArguments(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_ARGUMENTS) fail('arguments');
  const argumentSpecs = [];
  const seen = new Set();
  for (const item of value) {
    if (!item || Array.isArray(item) || typeof item !== 'object') fail('arguments.item');
    for (const field of Object.keys(item)) if (!ARGUMENT_FIELDS.has(field)) fail(`arguments.field:${field}`);
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!ARGUMENT_NAME_PATTERN.test(name)) fail('arguments.name');
    if (seen.has(name)) fail('arguments.duplicate');
    if (item.required !== undefined && typeof item.required !== 'boolean') fail('arguments.required');
    if (item.maxLength !== undefined
      && (!Number.isInteger(item.maxLength) || item.maxLength < 1 || item.maxLength > MAX_ARGUMENT_LENGTH)) {
      fail('arguments.maxLength');
    }
    seen.add(name);
    argumentSpecs.push(Object.freeze({
      name,
      description: item.description === undefined ? '' : requireText(item.description, 'arguments.description', 200),
      required: item.required === true,
      maxLength: item.maxLength === undefined ? MAX_ARGUMENT_LENGTH : item.maxLength
    }));
  }
  return Object.freeze(argumentSpecs);
}

function normalizeInstructions(value) {
  const instructions = requireText(value, 'instructions', MAX_INSTRUCTIONS_LENGTH);
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(instructions)) fail('instructions.secret');
  }
  return instructions;
}

export function normalizeSkillManifest(input = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('manifest');
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail(`field:${field}`);

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!NAME_PATTERN.test(name)) fail('name');

  const source = typeof input.source === 'string' ? input.source.trim() : '';
  if (!SOURCES.includes(source)) fail('source');

  const execution = input.execution === undefined ? 'inline' : input.execution;
  if (!EXECUTION_MODES.includes(execution)) fail('execution');

  if (source === 'project') {
    if (!SCOPE_PATTERN.test(typeof input.projectScope === 'string' ? input.projectScope.trim() : '')) {
      fail('projectScope');
    }
  } else if (input.projectScope !== undefined) {
    fail('projectScope.unexpected');
  }

  const model = input.model === undefined ? null : (typeof input.model === 'string' ? input.model.trim() : '');
  if (model !== null && !MODEL_PATTERN.test(model)) fail('model');

  return Object.freeze({
    name,
    description: requireText(input.description, 'description', MAX_DESCRIPTION_LENGTH),
    source,
    projectScope: source === 'project' ? input.projectScope.trim() : null,
    triggers: normalizeTriggers(input.triggers),
    allowedTools: normalizeAllowedTools(input.allowedTools),
    arguments: normalizeArguments(input.arguments),
    model,
    execution,
    instructions: normalizeInstructions(input.instructions)
  });
}

export const SKILL_MANIFEST_LIMITS = Object.freeze({
  sources: SOURCES,
  executionModes: EXECUTION_MODES,
  maxInstructionsLength: MAX_INSTRUCTIONS_LENGTH,
  maxTriggers: MAX_TRIGGERS,
  maxTools: MAX_TOOLS,
  maxArguments: MAX_ARGUMENTS,
  maxArgumentLength: MAX_ARGUMENT_LENGTH
});
