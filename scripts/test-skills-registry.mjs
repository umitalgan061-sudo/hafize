import assert from 'node:assert/strict';
import { SKILL_REGISTRY_LIMITS, createSkillRegistry } from '../lib/skills-registry.mjs';

function skill(id, overrides = {}) {
  return {
    id,
    name: id,
    description: `${id} açıklaması`,
    execution: 'inline',
    prompt: `${id} istemi`,
    ...overrides
  };
}

const agent = {
  id: 'hafize-general',
  toolPolicy: {
    default: 'deny',
    allow: ['task.read', 'connector.gmail.read'],
    approvalRequired: ['external.write']
  }
};

const registry = createSkillRegistry({
  builtin: [skill('ozet', { triggers: ['özet çıkar'], allowedTools: ['task.read'] }), skill('plan')],
  user: [skill('ozet', { name: 'Kişisel Özet', triggers: ['özet çıkar'] }), skill('gunluk', { triggers: ['günlük'] })],
  project: [skill('repo-notu', { execution: 'fork', triggers: ['repo notu'] })],
  projectScopeAllowed: true
});

const list = registry.list();
assert.deepEqual(list.map((item) => `${item.id}:${item.source}`), [
  'ozet:user',
  'plan:builtin',
  'gunluk:user',
  'repo-notu:project'
]);
assert.equal(list[0].name, 'Kişisel Özet');
assert.equal(list[0].overrides, 'builtin');
assert.equal(list[1].overrides, null);
assert.equal(Object.isFrozen(list), true);
assert.equal(Object.isFrozen(list[0]), true);
assert.equal('prompt' in list[0], false);
assert.equal('allowedTools' in list[0], false);

assert.equal(registry.resolve('gunluk').source, 'user');
assert.equal(registry.resolve(' gunluk ').id, 'gunluk');
assert.equal(registry.resolve('yok'), null);
assert.equal(registry.resolve(''), null);
assert.equal(registry.resolve(null), null);

assert.deepEqual(registry.match('Bana bugünün ÖZET çıkar raporunu ver'), ['ozet']);
assert.deepEqual(registry.match('günlük ve repo notu birlikte'), ['gunluk', 'repo-notu']);
assert.deepEqual(registry.match('günlük ve repo notu birlikte', { limit: 1 }), ['gunluk']);
assert.deepEqual(registry.match('eşleşme yok'), []);
assert.deepEqual(registry.match(''), []);
assert.deepEqual(registry.match(null), []);
assert.deepEqual(registry.match(`${'x'.repeat(SKILL_REGISTRY_LIMITS.maxMatchTextLength)}günlük`), []);

// Proje kaynağı yalnız açıkça izin verilen kapsamda yüklenir.
assert.throws(() => createSkillRegistry({ project: [skill('repo-notu')] }), /PROJECT_SKILL_SCOPE_DENIED/);
assert.throws(
  () => createSkillRegistry({ project: [skill('repo-notu')], projectScopeAllowed: 'evet' }),
  /PROJECT_SKILL_SCOPE_DENIED/
);

// Proje skill'i builtin veya kullanıcı skill'ini gölgeleyemez.
for (const base of [{ builtin: [skill('ozet')] }, { user: [skill('ozet')] }]) {
  assert.throws(
    () => createSkillRegistry({ ...base, project: [skill('ozet')], projectScopeAllowed: true }),
    /SKILL_PROJECT_SHADOW:ozet/
  );
}

assert.throws(() => createSkillRegistry({ builtin: [skill('ozet'), skill('ozet')] }), /SKILL_DUPLICATE_ID:builtin:ozet/);
assert.throws(() => createSkillRegistry({ user: 'ozet' }), /INVALID_SKILL_SOURCE_LIST:user/);
assert.throws(
  () => createSkillRegistry({
    builtin: Array.from({ length: SKILL_REGISTRY_LIMITS.maxSkillsPerSource + 1 }, (_, i) => skill(`s${i}`))
  }),
  /INVALID_SKILL_SOURCE_LIST:builtin/
);
assert.throws(() => createSkillRegistry({ builtin: [skill('ozet', { execution: 'shell' })] }), /INVALID_SKILL_EXECUTION/);

const allowed = registry.authorizeSkill(agent, 'ozet');
assert.equal(allowed.ok, true);
assert.deepEqual(allowed.tools, []);
assert.equal(allowed.execution, 'inline');
assert.equal(allowed.inheritsParentTools, false);
assert.equal(allowed.skill.prompt, 'ozet istemi');

const forkSkill = registry.authorizeSkill(agent, 'repo-notu');
assert.equal(forkSkill.ok, true);
assert.equal(forkSkill.execution, 'fork');
assert.equal(forkSkill.inheritsParentTools, false);

assert.deepEqual(registry.authorizeSkill(agent, 'yok'), { ok: false, error: 'SKILL_NOT_FOUND' });

// Skill, ajanın sahip olmadığı aracı kullanamaz.
const toolRegistry = createSkillRegistry({
  builtin: [
    skill('mail-ozet', { allowedTools: ['connector.gmail.read', 'task.read'] }),
    skill('canva-ozet', { allowedTools: ['connector.canva.read'] })
  ]
});
assert.equal(toolRegistry.authorizeSkill(agent, 'mail-ozet').ok, true);
assert.deepEqual(toolRegistry.authorizeSkill(agent, 'canva-ozet'), {
  ok: false,
  error: 'SKILL_TOOL_NOT_AUTHORIZED',
  tool: 'connector.canva.read',
  reason: 'default_deny'
});
assert.equal(toolRegistry.authorizeSkill({ id: 'bos' }, 'mail-ozet').ok, false);

console.log('skills registry tests passed');
