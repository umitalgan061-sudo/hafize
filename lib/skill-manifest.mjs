// Hafize skills sözleşmesi: bir skill'in kimliği, tetikleyicileri, izinli araçları,
// argümanları, model tercihi ve execution bağlamı ayrı ayrı ve strict doğrulanır.
// Bu katman yalnız manifest doğrulama ve kayıt çözümlemesi yapar; skill çalıştırmaz.
import { authorizeAgentTool } from './agent-runtime.mjs';

const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const ARGUMENT_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\/-]{1,127}$/;
const SCOPE_PATTERN = /^[a-z0-9][a-z0-9._\/-]{0,127}$/;
const TOP_FIELDS = new Set([
  'id', 'name', 'description', 'triggers', 'execution', 'allowedTools', 'arguments', 'model', 'prompt', 'scope'
]);
const ARGUMENT_FIELDS = new Set(['name', 'required', 'description']);
const EXECUTIONS = new Set(['inline', 'fork']);
// Kaynak önceliği: aynı id için daha spesifik kaynak kazanır.
const SOURCE_PRIORITY = new Map([['builtin', 0], ['user', 1], ['project', 2]]);
// Skill kendi yetkisini yükseltemez: bu izinler manifestte hiçbir kaynakta istenemez.
const FORBIDDEN_SKILL_PERMISSIONS = new Set([
  'secret.read', 'repo.delete', 'external.write', 'external.send', 'repo.merge', 'repo.write_branch'
]);
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|password|passphrase)\b\s*[:=]\s*\S/i,
  /\b[A-Z][A-Z0-9_]{7,}\s*=\s*\S/,
  /\b(nvapi-|ghp_|github_pat_|sk-[A-Za-z0-9]{8})/
];
const LIMITS = Object.freeze({
  maxTriggers: 12,
  maxArguments: 8,
  maxAllowedTools: 12,
  maxPromptLength: 20_000
});

function fail(code) {
  const error = new Error(`INVALID_SKILL_MANIFEST:${code}`);
  error.code = 'INVALID_SKILL_MANIFEST';
  error.field = code;
  throw error;
}

function text(value, field, { min = 1, max = 400 } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < min || normalized.length > max || normalized.includes('\0')) fail(field);
  return normalized;
}

function uniqueList(value, field, { max, normalize }) {
  if (!Array.isArray(value) || value.length > max) fail(field);
  const seen = new Set();
  const items = [];
  for (const item of value) {
    const normalized = normalize(item, field);
    if (seen.has(normalized)) fail(`${field}.duplicate`);
    seen.add(normalized);
    items.push(normalized);
  }
  return Object.freeze(items);
}

function normalizeArguments(value) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > LIMITS.maxArguments) fail('arguments');
  const seen = new Set();
  const args = value.map((entry) => {
    if (!entry || Array.isArray(entry) || typeof entry !== 'object') fail('arguments.entry');
    for (const key of Object.keys(entry)) if (!ARGUMENT_FIELDS.has(key)) fail(`arguments.${key}`);
    const name = text(entry.name, 'arguments.name', { max: 32 });
    if (!ARGUMENT_PATTERN.test(name)) fail('arguments.name');
    if (seen.has(name)) fail('arguments.duplicate');
    seen.add(name);
    if (entry.required !== undefined && typeof entry.required !== 'boolean') fail('arguments.required');
    return Object.freeze({
      name,
      required: entry.required === true,
      description: entry.description === undefined ? '' : text(entry.description, 'arguments.description', { max: 200 })
    });
  });
  return Object.freeze(args);
}

function normalizePrompt(value) {
  const prompt = text(value, 'prompt', { max: LIMITS.maxPromptLength });
  // Skill prompt'u secret veya credential taşıyamaz.
  for (const pattern of SECRET_PATTERNS) if (pattern.test(prompt)) fail('prompt.secret');
  return prompt;
}

export function normalizeSkillManifest(input, { source, allowedProjectScopes = [] } = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('manifest');
  if (!SOURCE_PRIORITY.has(source)) fail('source');
  for (const key of Object.keys(input)) if (!TOP_FIELDS.has(key)) fail(`field.${key}`);

  const id = text(input.id, 'id', { max: 64 });
  if (!ID_PATTERN.test(id)) fail('id');

  const execution = text(input.execution, 'execution', { max: 16 });
  if (!EXECUTIONS.has(execution)) fail('execution');

  const allowedTools = uniqueList(input.allowedTools === undefined ? [] : input.allowedTools, 'allowedTools', {
    max: LIMITS.maxAllowedTools,
    normalize: (item) => {
      const permission = text(item, 'allowedTools.permission', { max: 120 });
      if (!PERMISSION_PATTERN.test(permission)) fail('allowedTools.permission');
      if (FORBIDDEN_SKILL_PERMISSIONS.has(permission)) fail(`allowedTools.forbidden:${permission}`);
      return permission;
    }
  });

  let scope = null;
  if (source === 'project') {
    // Project skill yalnız açıkça izin verilen proje kapsamından yüklenir.
    scope = text(input.scope, 'scope', { max: 128 });
    if (!SCOPE_PATTERN.test(scope)) fail('scope');
    if (!Array.isArray(allowedProjectScopes) || !allowedProjectScopes.includes(scope)) fail('scope.notAllowed');
  } else if (input.scope !== undefined) {
    fail('scope.unexpected');
  }

  return Object.freeze({
    id,
    source,
    scope,
    name: text(input.name, 'name', { max: 80 }),
    description: text(input.description, 'description', { max: 400 }),
    triggers: uniqueList(input.triggers, 'triggers', {
      max: LIMITS.maxTriggers,
      normalize: (item) => text(item, 'triggers.value', { max: 64 }).toLowerCase()
    }),
    execution,
    allowedTools,
    arguments: normalizeArguments(input.arguments),
    model: input.model === undefined ? null : (() => {
      const model = text(input.model, 'model', { max: 128 });
      if (!MODEL_PATTERN.test(model)) fail('model');
      return model;
    })(),
    prompt: normalizePrompt(input.prompt)
  });
}

export function buildSkillRegistry(entries, { allowedProjectScopes = [] } = {}) {
  if (!Array.isArray(entries)) fail('entries');
  const byId = new Map();
  for (const entry of entries) {
    if (!entry || Array.isArray(entry) || typeof entry !== 'object') fail('entries.entry');
    const skill = normalizeSkillManifest(entry.manifest, { source: entry.source, allowedProjectScopes });
    const existing = byId.get(skill.id);
    if (existing && SOURCE_PRIORITY.get(existing.source) >= SOURCE_PRIORITY.get(skill.source)) continue;
    byId.set(skill.id, skill);
  }
  return Object.freeze([...byId.values()].sort((a, b) => a.id.localeCompare(b.id)));
}

export function resolveSkillForAgent(registry, skillId, agent, { approvalGranted = false } = {}) {
  const skills = Array.isArray(registry) ? registry : [];
  const skill = skills.find((entry) => entry.id === skillId) || null;
  if (!skill) return { allowed: false, reason: 'SKILL_NOT_FOUND', skill: null };
  // Skill, ajanın sahip olmadığı bir aracı kullanamaz; miras veya yükseltme yoktur.
  for (const permission of skill.allowedTools) {
    const authorization = authorizeAgentTool(agent, permission, { approvalGranted });
    if (!authorization.allowed) {
      return { allowed: false, reason: 'SKILL_TOOL_NOT_AUTHORIZED', permission, skill: null };
    }
  }
  return { allowed: true, reason: null, skill };
}

export const SKILL_LIMITS = LIMITS;
export const SKILL_SOURCES = Object.freeze([...SOURCE_PRIORITY.keys()]);
