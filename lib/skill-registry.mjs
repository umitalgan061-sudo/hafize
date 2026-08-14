const ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const ARG_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const TRIGGER_PATTERN = /^\/[a-z][a-z0-9-]{0,63}$/;
const SOURCES = Object.freeze(['builtin', 'user', 'project']);
const SOURCE_RANK = new Map(SOURCES.map((source, index) => [source, index]));
const TOP_FIELDS = new Set([
  'id', 'name', 'description', 'triggers', 'allowedPermissions', 'prompt',
  'execution', 'forkAgentId', 'arguments', 'model', 'userInvocable'
]);

function fail(field) {
  const error = new Error(`INVALID_SKILL_MANIFEST:${field}`);
  error.code = 'INVALID_SKILL_MANIFEST';
  throw error;
}

function requireString(value, field, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength) fail(field);
  return text;
}

function normalizeStringList(value, field, { maxItems, pattern, maxLength }) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > maxItems) fail(field);
  const seen = new Set();
  const output = [];
  for (const item of value) {
    const text = typeof item === 'string' ? item.trim() : '';
    if (!text || text.length > maxLength || (pattern && !pattern.test(text)) || seen.has(text)) fail(field);
    seen.add(text);
    output.push(text);
  }
  return Object.freeze(output);
}

export function normalizeSkillManifest(input, { source = 'builtin' } = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('manifest');
  if (!SOURCE_RANK.has(source)) fail('source');
  for (const field of Object.keys(input)) if (!TOP_FIELDS.has(field)) fail(`unknown:${field}`);

  const id = requireString(input.id, 'id', 64);
  if (!ID_PATTERN.test(id)) fail('id');
  const name = requireString(input.name, 'name', 100);
  const description = requireString(input.description, 'description', 500);
  const prompt = requireString(input.prompt, 'prompt', 12_000);
  const execution = input.execution == null ? 'inline' : input.execution;
  if (!['inline', 'fork'].includes(execution)) fail('execution');
  const triggers = normalizeStringList(input.triggers ?? [`/${id}`], 'triggers', {
    maxItems: 8, pattern: TRIGGER_PATTERN, maxLength: 65
  });
  if (!triggers.length) fail('triggers');
  const allowedPermissions = normalizeStringList(input.allowedPermissions, 'allowedPermissions', {
    maxItems: 16, pattern: PERMISSION_PATTERN, maxLength: 120
  });
  const argumentsList = normalizeStringList(input.arguments, 'arguments', {
    maxItems: 12, pattern: ARG_PATTERN, maxLength: 32
  });
  const userInvocable = input.userInvocable !== false;
  const model = input.model == null ? null : requireString(input.model, 'model', 160);
  const forkAgentId = input.forkAgentId == null ? null : requireString(input.forkAgentId, 'forkAgentId', 80);
  if (execution === 'fork' && !forkAgentId) fail('forkAgentId');
  if (execution === 'fork' && !allowedPermissions.includes('agent.delegate')) fail('allowedPermissions');
  if (execution === 'inline' && forkAgentId) fail('forkAgentId');

  return Object.freeze({
    id, name, description, triggers, allowedPermissions, prompt, execution,
    forkAgentId, arguments: argumentsList, model, userInvocable, source
  });
}

function addSource(target, manifests, source) {
  if (!Array.isArray(manifests)) fail(`source:${source}`);
  const withinSource = new Set();
  for (const manifest of manifests) {
    const skill = normalizeSkillManifest(manifest, { source });
    if (withinSource.has(skill.id)) fail(`duplicate:${source}:${skill.id}`);
    withinSource.add(skill.id);
    const existing = target.get(skill.id);
    if (!existing || SOURCE_RANK.get(source) >= SOURCE_RANK.get(existing.source)) target.set(skill.id, skill);
  }
}

export function createSkillRegistry({ builtin = [], user = [], project = [] } = {}) {
  const skills = new Map();
  addSource(skills, builtin, 'builtin');
  addSource(skills, user, 'user');
  addSource(skills, project, 'project');
  return Object.freeze({
    get(id) { return typeof id === 'string' ? skills.get(id) || null : null; },
    list() { return Object.freeze([...skills.values()]); },
    size: skills.size
  });
}

export function listPublicSkills(registry) {
  if (!registry || typeof registry.list !== 'function') fail('registry');
  return registry.list().filter((skill) => skill.userInvocable).map((skill) => Object.freeze({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    triggers: skill.triggers,
    execution: skill.execution,
    source: skill.source
  }));
}

export function resolveExplicitSkill(registry, input) {
  if (!registry || typeof registry.list !== 'function') fail('registry');
  const text = typeof input === 'string' ? input.trim() : '';
  if (!text.startsWith('/')) return null;
  const trigger = text.split(/\s+/, 1)[0];
  return registry.list().find((skill) => skill.userInvocable && skill.triggers.includes(trigger)) || null;
}
