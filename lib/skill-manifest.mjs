import { authorizeAgentTool } from './agent-runtime.mjs';

const TOP_FIELDS = new Set(['id', 'name', 'description', 'triggers', 'execution', 'allowedTools', 'arguments', 'model', 'prompt']);
const ARGUMENT_FIELDS = new Set(['name', 'description', 'required']);
const ID_PATTERN = /^[a-z][a-z0-9-]{0,46}[a-z0-9]$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const ARGUMENT_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const EXECUTION_MODES = new Set(['inline', 'fork']);
const MODEL_PREFERENCES = new Set(['default', 'fast', 'reasoning']);
const NEVER_SKILL_PERMISSIONS = new Set(['secret.read', 'repo.delete', 'agent.delegate']);
const APPROVAL_ONLY_PERMISSIONS = new Set(['external.write', 'external.send', 'repo.merge', 'repo.write_branch']);
const INTERPOLATION_PATTERN = /\$\{|\{\{|<%|process\.env/;

const LIMITS = Object.freeze({
  maxNameLength: 80,
  maxDescriptionLength: 400,
  maxTriggers: 12,
  maxTriggerLength: 120,
  maxTools: 12,
  maxArguments: 8,
  maxPromptLength: 8000
});

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function requireText(value, label, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength || text.includes('\0')) fail(`INVALID_SKILL_MANIFEST:${label}`);
  return text;
}

function normalizeUniqueList(value, label, maxLength, normalizeItem) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > maxLength) fail(`INVALID_SKILL_MANIFEST:${label}`);

  const items = [];
  const seen = new Set();
  for (const raw of value) {
    const item = normalizeItem(raw);
    const key = typeof item === 'string' ? item : item.name;
    if (seen.has(key)) fail(`INVALID_SKILL_MANIFEST:${label}.duplicate`);
    seen.add(key);
    items.push(item);
  }
  return Object.freeze(items);
}

function normalizeTool(raw) {
  const tool = typeof raw === 'string' ? raw.trim() : '';
  if (!PERMISSION_PATTERN.test(tool)) fail('INVALID_SKILL_MANIFEST:allowedTools.permission');
  if (NEVER_SKILL_PERMISSIONS.has(tool)) fail(`SKILL_PERMISSION_FORBIDDEN:${tool}`);
  if (APPROVAL_ONLY_PERMISSIONS.has(tool)) fail(`SKILL_PERMISSION_REQUIRES_APPROVAL:${tool}`);
  return tool;
}

function normalizeArgument(raw) {
  if (!raw || Array.isArray(raw) || typeof raw !== 'object') fail('INVALID_SKILL_MANIFEST:argument');
  for (const field of Object.keys(raw)) {
    if (!ARGUMENT_FIELDS.has(field)) fail('INVALID_SKILL_MANIFEST:argument.field');
  }
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!ARGUMENT_PATTERN.test(name)) fail('INVALID_SKILL_MANIFEST:argument.name');
  if (raw.required != null && typeof raw.required !== 'boolean') fail('INVALID_SKILL_MANIFEST:argument.required');
  return Object.freeze({
    name,
    description: requireText(raw.description, 'argument.description', LIMITS.maxDescriptionLength),
    required: raw.required === true
  });
}

function normalizePrompt(value) {
  const prompt = typeof value === 'string' ? value.trim() : '';
  if (!prompt || prompt.length > LIMITS.maxPromptLength || prompt.includes('\0')) fail('INVALID_SKILL_MANIFEST:prompt');
  if (INTERPOLATION_PATTERN.test(prompt)) fail('SKILL_PROMPT_INTERPOLATION_FORBIDDEN');
  return prompt;
}

export function normalizeSkillManifest(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_SKILL_MANIFEST:manifest');
  for (const field of Object.keys(input)) {
    if (!TOP_FIELDS.has(field)) fail('INVALID_SKILL_MANIFEST:field');
  }

  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!ID_PATTERN.test(id)) fail('INVALID_SKILL_MANIFEST:id');
  const execution = typeof input.execution === 'string' ? input.execution.trim() : '';
  if (!EXECUTION_MODES.has(execution)) fail('INVALID_SKILL_MANIFEST:execution');
  const model = input.model == null ? 'default' : String(input.model).trim();
  if (!MODEL_PREFERENCES.has(model)) fail('INVALID_SKILL_MANIFEST:model');
  if (!Array.isArray(input.allowedTools)) fail('INVALID_SKILL_MANIFEST:allowedTools');

  return Object.freeze({
    id,
    name: requireText(input.name, 'name', LIMITS.maxNameLength),
    description: requireText(input.description, 'description', LIMITS.maxDescriptionLength),
    triggers: normalizeUniqueList(input.triggers, 'triggers', LIMITS.maxTriggers, (raw) =>
      requireText(raw, 'trigger', LIMITS.maxTriggerLength).toLowerCase()),
    execution,
    allowedTools: normalizeUniqueList(input.allowedTools, 'allowedTools', LIMITS.maxTools, normalizeTool),
    arguments: normalizeUniqueList(input.arguments, 'arguments', LIMITS.maxArguments, normalizeArgument),
    model,
    prompt: normalizePrompt(input.prompt)
  });
}

export function authorizeSkillTools(skill, agent, { approvalGranted = false } = {}) {
  if (!skill?.id || !Array.isArray(skill.allowedTools)) return { ok: false, error: 'INVALID_SKILL' };
  if (!agent?.id) return { ok: false, error: 'INVALID_SKILL_AGENT' };

  for (const tool of skill.allowedTools) {
    const authorization = authorizeAgentTool(agent, tool, { approvalGranted });
    if (!authorization.allowed) {
      return { ok: false, error: `SKILL_TOOL_NOT_AUTHORIZED:${tool}`, reason: authorization.reason };
    }
  }
  return { ok: true, tools: Object.freeze([...skill.allowedTools]) };
}

export const SKILL_MANIFEST_LIMITS = LIMITS;
export const SKILL_EXECUTION_MODES = Object.freeze([...EXECUTION_MODES]);
