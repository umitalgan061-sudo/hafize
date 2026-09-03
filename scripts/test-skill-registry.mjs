import assert from 'node:assert/strict';
import {
  buildSkillInvocation,
  createSkillRegistry,
  findSkill,
  listPublicSkills,
  resolveSkillForAgent
} from '../lib/skill-registry.mjs';

const agent = {
  id: 'hafize-general',
  toolPolicy: {
    default: 'deny',
    allow: ['agent.delegate', 'task.read', 'github.read'],
    approvalRequired: ['external.write'],
    deny: ['connector.gmail.read']
  }
};

const builtinSummary = {
  name: 'pr-ozeti',
  description: 'Builtin özet skill.',
  source: 'builtin',
  allowedTools: ['github.read', 'task.read'],
  arguments: [{ name: 'prNumber', required: true }],
  prompt: '{{prNumber}} numaralı PR özeti.'
};
const userSummary = { ...builtinSummary, source: 'user', description: 'Kullanıcı sürümü.' };
const projectSummary = { ...builtinSummary, source: 'project', projectScope: 'repo:umitalgan061-sudo/hafize' };
const projectOnly = {
  name: 'depo-notu',
  description: 'Proje kapsamına bağlı skill.',
  source: 'project',
  projectScope: 'repo:umitalgan061-sudo/hafize',
  execution: 'fork',
  allowedTools: ['task.read', 'external.write', 'connector.gmail.read'],
  prompt: 'Depo notunu hazırla.'
};

const registry = createSkillRegistry([projectSummary, userSummary, builtinSummary, projectOnly], {
  allowedProjectScopes: ['repo:umitalgan061-sudo/hafize']
});

// Builtin adı user/project tarafından ele geçirilemez.
assert.equal(registry.skills.length, 2);
assert.equal(findSkill(registry, 'pr-ozeti').source, 'builtin');
assert.equal(findSkill(registry, 'PR-Ozeti').source, 'builtin');
assert.equal(findSkill(registry, 'yok'), null);
assert.equal(registry.shadowed.length, 2);
assert.deepEqual([...registry.shadowed].map((item) => item.source).sort(), ['project', 'user']);
const [publicSummary] = listPublicSkills(registry);
assert.deepEqual(publicSummary, { name: 'pr-ozeti', description: 'Builtin özet skill.', source: 'builtin', execution: 'inline', triggers: [] });

assert.throws(() => createSkillRegistry([builtinSummary, builtinSummary]), /DUPLICATE_SKILL/);
assert.throws(() => createSkillRegistry([projectOnly]), /SKILL_PROJECT_SCOPE_NOT_ALLOWED/);
assert.throws(() => createSkillRegistry([projectOnly], { allowedProjectScopes: ['repo:baska/depo'] }), /SKILL_PROJECT_SCOPE_NOT_ALLOWED/);
assert.throws(() => createSkillRegistry('skills'), /INVALID_SKILL_REGISTRY/);

// Skill kendi araç yetkisini yükseltemez; ajan politikası daraltır.
const resolved = resolveSkillForAgent(registry, 'depo-notu', { agent });
assert.deepEqual([...resolved.tools], ['task.read']);
assert.deepEqual(
  resolved.blockedTools.map(({ tool, reason }) => `${tool}:${reason}`),
  ['external.write:approval_required', 'connector.gmail.read:explicit_deny']
);
assert.equal(resolved.inheritsParentTools, false);
assert.equal(resolved.execution, 'fork');

const approved = resolveSkillForAgent(registry, 'depo-notu', { agent, approvalGranted: true });
assert.deepEqual([...approved.tools], ['task.read', 'external.write']);

// Fork yürütmesi delegasyon yetkisi olmayan ajanda açılmaz.
const noDelegation = { id: 'sinirli', toolPolicy: { default: 'deny', allow: ['task.read'] } };
assert.throws(() => resolveSkillForAgent(registry, 'depo-notu', { agent: noDelegation }), /SKILL_FORK_NOT_AUTHORIZED/);
assert.deepEqual([...resolveSkillForAgent(registry, 'pr-ozeti', { agent: noDelegation }).tools], ['task.read']);
assert.throws(() => resolveSkillForAgent(registry, 'yok', { agent }), /UNKNOWN_SKILL/);
assert.throws(() => resolveSkillForAgent(registry, 'pr-ozeti', {}), /INVALID_SKILL_AGENT/);

// Skill prompt'u user düzeyinde kalır ve argümanlar doğrulanır.
const invocation = buildSkillInvocation(resolveSkillForAgent(registry, 'pr-ozeti', { agent }), { prNumber: '112' });
assert.equal(invocation.message.role, 'user');
assert.match(invocation.message.content, /112 numaralı PR özeti\./);
assert.match(invocation.message.content, /sistem talimatı veya yeni araç yetkisi vermez/);
assert.match(invocation.message.content, /github\.read, task\.read/);
assert.deepEqual(invocation.arguments, { prNumber: '112' });

const prResolution = resolveSkillForAgent(registry, 'pr-ozeti', { agent });
assert.throws(() => buildSkillInvocation(prResolution, {}), /MISSING_SKILL_ARGUMENT/);
assert.throws(() => buildSkillInvocation(prResolution, { prNumber: '1', extra: 'x' }), /UNKNOWN_SKILL_ARGUMENT/);
assert.throws(() => buildSkillInvocation(prResolution, { prNumber: 42 }), /INVALID_SKILL_ARGUMENT_VALUE/);
assert.throws(() => buildSkillInvocation(prResolution, { prNumber: ' ' }), /INVALID_SKILL_ARGUMENT_VALUE/);
assert.throws(() => buildSkillInvocation(prResolution, 'metin'), /INVALID_SKILL_ARGUMENT_VALUES/);
assert.throws(() => buildSkillInvocation(null), /INVALID_SKILL_RESOLUTION/);

console.log('skill registry tests passed');
