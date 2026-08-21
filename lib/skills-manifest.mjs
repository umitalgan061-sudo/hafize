import { authorizeAgentTool } from './agent-runtime.mjs';

const SKILL_NAME_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const TOOL_PATTERN = /^[a-z][a-z0-9_.:-]{0,119}$/;
const ARGUMENT_NAME_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._/-]{1,79}$/;
const PROJECT_SCOPE_PATTERN = /^[a-z0-9][a-z0-9._/-]{0,119}$/;

const SOURCE_RANK = Object.freeze({ builtin: 0, user: 1, project: 2 });
const EXECUTION_CONTEXTS = new Set(['inline', 'fork']);
const ARGUMENT_TYPES = new Set(['string', 'number', 'boolean']);
const NEVER_SKILL_TOOLS = new Set(['secret.read', 'repo.delete']);
const APPROVAL_ONLY_TOOLS = new Set(['external.write', 'external.send', 'repo.merge', 'repo.write_branch']);

const MAX_DESCRIPTION_CHARS = 400;
const MAX_PROMPT_CHARS = 20_000;
const MAX_TRIGGERS = 12;
const MAX_TOOLS = 16;
const MAX_ARGUMENTS = 8;

const SECRET_PATTERNS = [
  /process\.env/i,
  /\$\{[^}]*\}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|bearer)\b\s*[:=]/i,
  /\bsk-[A-Za-z0-9]{16,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{16,}\b/
];

function fail(field) {
  throw new Error(`INVALID_SKILL_MANIFEST:${field}`);
}

function requireString(value, field, maxChars) {
  if (typeof value !== 'string') fail(field);
  const text = value.trim();
  if (!text || text.length > maxChars) fail(field);
  return text;
}

function requireStringList(value, field, { pattern, maxItems, maxChars }) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems) fail(field);
  const items = [];
  const seen = new Set();
  for (const entry of value) {
    const item = requireString(entry, `${field}.item`, maxChars);
    if (pattern && !pattern.test(item)) fail(`${field}.item`);
    if (seen.has(item)) fail(`${field}.duplicate`);
    seen.add(item);
    items.push(item);
  }
  return items;
}

function requireTools(value) {
  const tools = requireStringList(value, 'allowedTools', {
    pattern: TOOL_PATTERN,
    maxItems: MAX_TOOLS,
    maxChars: 120
  });
  for (const tool of tools) {
    if (NEVER_SKILL_TOOLS.has(tool)) fail(`allowedTools.forbidden:${tool}`);
    if (APPROVAL_ONLY_TOOLS.has(tool)) fail(`allowedTools.approvalRequired:${tool}`);
  }
  return tools;
}

function requireArguments(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_ARGUMENTS) fail('arguments');
  const names = new Set();
  return value.map((entry) => {
    const name = requireString(entry?.name, 'arguments.name', 32);
    if (!ARGUMENT_NAME_PATTERN.test(name)) fail('arguments.name');
    if (names.has(name)) fail(`arguments.duplicate:${name}`);
    names.add(name);
    const type = entry?.type === undefined ? 'string' : entry.type;
    if (typeof type !== 'string' || !ARGUMENT_TYPES.has(type)) fail(`arguments.type:${name}`);
    if (entry?.required !== undefined && typeof entry.required !== 'boolean') fail(`arguments.required:${name}`);
    const description = entry?.description === undefined
      ? ''
      : requireString(entry.description, `arguments.description:${name}`, MAX_DESCRIPTION_CHARS);
    return Object.freeze({ name, type, required: entry?.required === true, description });
  });
}

function requirePrompt(value) {
  const prompt = requireString(value, 'prompt', MAX_PROMPT_CHARS);
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(prompt)) fail('prompt.secretMaterial');
  }
  return prompt;
}

function requireExecutionContext(value, { source, tools }) {
  const executionContext = value === undefined ? 'inline' : value;
  if (typeof executionContext !== 'string' || !EXECUTION_CONTEXTS.has(executionContext)) fail('executionContext');
  if (source === 'project' && tools.length > 0 && executionContext !== 'fork') {
    fail('executionContext.projectIsolation');
  }
  return executionContext;
}

function requireProjectScope(source, projectScope, allowedProjectScopes) {
  if (source !== 'project') {
    if (projectScope !== undefined && projectScope !== null) fail('projectScope.unexpected');
    return null;
  }
  const scope = requireString(projectScope, 'projectScope', 120);
  if (!PROJECT_SCOPE_PATTERN.test(scope)) fail('projectScope');
  const allowed = Array.isArray(allowedProjectScopes) ? allowedProjectScopes : [];
  if (!allowed.includes(scope)) fail(`projectScope.notAllowed:${scope}`);
  return scope;
}

export function normalizeSkillManifest(input, { source, projectScope, allowedProjectScopes = [] } = {}) {
  if (typeof source !== 'string' || !(source in SOURCE_RANK)) fail('source');
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('manifest');

  const scope = requireProjectScope(source, projectScope, allowedProjectScopes);
  const name = requireString(input.name, 'name', 64);
  if (!SKILL_NAME_PATTERN.test(name)) fail('name');

  const tools = requireTools(input.allowedTools);
  const model = input.model === undefined ? null : requireString(input.model, 'model', 80);
  if (model !== null && !MODEL_PATTERN.test(model)) fail('model');

  return Object.freeze({
    name,
    source,
    projectScope: scope,
    description: requireString(input.description, 'description', MAX_DESCRIPTION_CHARS),
    triggers: Object.freeze(requireStringList(input.triggers, 'triggers', {
      maxItems: MAX_TRIGGERS,
      maxChars: 120
    })),
    allowedTools: Object.freeze(tools),
    arguments: Object.freeze(requireArguments(input.arguments)),
    model,
    executionContext: requireExecutionContext(input.executionContext, { source, tools }),
    prompt: requirePrompt(input.prompt)
  });
}

export function createSkillRegistry({ entries = [], allowedProjectScopes = [] } = {}) {
  if (!Array.isArray(entries)) fail('entries');
  const bySource = new Map();
  const skills = new Map();
  const shadowed = [];

  for (const entry of entries) {
    const skill = normalizeSkillManifest(entry?.manifest, {
      source: entry?.source,
      projectScope: entry?.projectScope,
      allowedProjectScopes
    });
    const sourceKey = `${skill.source}:${skill.projectScope || ''}:${skill.name}`;
    if (bySource.has(sourceKey)) fail(`duplicate:${sourceKey}`);
    bySource.set(sourceKey, skill);

    const current = skills.get(skill.name);
    if (!current) {
      skills.set(skill.name, skill);
      continue;
    }
    if (SOURCE_RANK[skill.source] === SOURCE_RANK[current.source]) fail(`duplicate:${skill.name}`);
    const winner = SOURCE_RANK[skill.source] < SOURCE_RANK[current.source] ? skill : current;
    const loser = winner === skill ? current : skill;
    skills.set(skill.name, winner);
    shadowed.push(Object.freeze({ name: loser.name, source: loser.source, shadowedBy: winner.source }));
  }

  const ordered = [...skills.values()].sort((left, right) => left.name.localeCompare(right.name));

  return Object.freeze({
    list: () => ordered,
    get: (name) => skills.get(typeof name === 'string' ? name.trim() : '') || null,
    shadowed: Object.freeze(shadowed),
    describe: () => ordered.map(({ name, source, description, executionContext, allowedTools }) => ({
      name,
      source,
      description,
      executionContext,
      allowedTools
    }))
  });
}

export function authorizeSkillForAgent(skill, agent, { approvalGranted = false } = {}) {
  if (!skill || typeof skill.name !== 'string') return { allowed: false, reason: 'invalid_skill', tools: [] };
  if (!agent) return { allowed: false, reason: 'invalid_agent', tools: [] };

  for (const tool of skill.allowedTools) {
    const decision = authorizeAgentTool(agent, tool, { approvalGranted });
    if (!decision.allowed) {
      return { allowed: false, reason: `tool_denied:${tool}:${decision.reason}`, tools: [] };
    }
  }
  return { allowed: true, reason: 'agent_scoped', tools: [...skill.allowedTools] };
}

export const SKILLS_MANIFEST_CONTRACT = Object.freeze({
  sourcePriority: Object.freeze(['builtin', 'user', 'project']),
  executionContexts: Object.freeze([...EXECUTION_CONTEXTS]),
  neverAllowedTools: Object.freeze([...NEVER_SKILL_TOOLS]),
  approvalOnlyTools: Object.freeze([...APPROVAL_ONLY_TOOLS]),
  limits: Object.freeze({
    descriptionChars: MAX_DESCRIPTION_CHARS,
    promptChars: MAX_PROMPT_CHARS,
    triggers: MAX_TRIGGERS,
    tools: MAX_TOOLS,
    arguments: MAX_ARGUMENTS
  }),
  rules: Object.freeze([
    'Skill kendi tool yetkisini yükseltemez; yetki ajan policy tarafından belirlenir.',
    'Onay gerektiren araçlar manifest içinde önceden yetkilendirilemez.',
    'Skill prompt metni secret veya credential materyali içeremez.',
    'Project skill yalnız açıkça izin verilen proje kapsamından yüklenir.',
    'Araç kullanan project skill yalnız fork execution context ile çalışır.',
    'Aynı ada sahip skill çakışmasında builtin > user > project önceliği uygulanır.'
  ])
});
