import assert from 'node:assert/strict';
import { SKILL_REGISTRY_LIMITS, createSkillRegistry, resolveSkillExecution } from '../lib/skill-registry.mjs';

const manifest = (overrides = {}) => ({
  name: 'release-notes',
  description: 'Sürüm notu taslağı hazırlar.',
  allowedTools: ['runtime.status'],
  execution: 'inline',
  prompt: 'Kısa ve doğrulanabilir sürüm notu yaz.',
  ...overrides
});

const agent = {
  id: 'hafize-general',
  toolPolicy: {
    default: 'deny',
    allow: ['runtime.status', 'agent.delegate', 'repo.read'],
    approvalRequired: ['external.write'],
    deny: ['pr.comment']
  }
};

const registry = createSkillRegistry({
  builtin: [manifest()],
  user: [manifest({ name: 'user-only', execution: 'fork' })],
  project: [manifest({ name: 'project-only', projectScope: 'umitalgan061-sudo/hafize' })],
  allowedProjectScopes: ['umitalgan061-sudo/hafize']
});

assert.equal(registry.size, 3);
assert.deepEqual(registry.list().map(({ name, source, execution }) => ({ name, source, execution })), [
  { name: 'release-notes', source: 'builtin', execution: 'inline' },
  { name: 'user-only', source: 'user', execution: 'fork' },
  { name: 'project-only', source: 'project', execution: 'inline' }
]);
assert.equal('prompt' in registry.list()[0], false); // liste görünümü prompt sızdırmaz
assert.equal(Object.isFrozen(registry), true);
assert.equal(registry.resolve('  release-notes  ').source, 'builtin');
assert.equal(registry.resolve('missing'), null);
assert.equal(registry.resolve(42), null);
assert.deepEqual(registry.rejected(), []);

// Düşük öncelikli kaynak, yüksek öncelikli skill adını gölgeleyemez.
const shadowed = createSkillRegistry({
  builtin: [manifest({ prompt: 'builtin sürüm' })],
  user: [manifest({ prompt: 'user sürüm' })],
  project: [manifest({ prompt: 'project sürüm', projectScope: 'scope-a' })],
  allowedProjectScopes: ['scope-a']
});
assert.equal(shadowed.size, 1);
assert.equal(shadowed.resolve('release-notes').prompt, 'builtin sürüm');
assert.deepEqual(shadowed.rejected(), [
  { source: 'user', name: 'release-notes', error: 'SKILL_NAME_SHADOWED' },
  { source: 'project', name: 'release-notes', error: 'SKILL_NAME_SHADOWED' }
]);

// İzinsiz proje kapsamı yüklenmez; geçersiz tek manifest registry'yi düşürmez ve sessizce yutulmaz.
const filtered = createSkillRegistry({
  builtin: [manifest(), manifest({ name: 'BAD NAME' }), null],
  project: [manifest({ name: 'allowed-project', projectScope: 'scope-a' }), manifest({ name: 'foreign-project', projectScope: 'scope-b' })],
  allowedProjectScopes: ['scope-a']
});
assert.deepEqual(filtered.list().map(({ name }) => name), ['release-notes', 'allowed-project']);
assert.deepEqual(filtered.rejected(), [
  { source: 'builtin', name: 'BAD NAME', error: 'INVALID_SKILL_NAME' },
  { source: 'builtin', name: null, error: 'INVALID_SKILL_MANIFEST' },
  { source: 'project', name: 'foreign-project', error: 'SKILL_PROJECT_SCOPE_NOT_ALLOWED' }
]);
assert.equal(Object.isFrozen(filtered.rejected()), true);

// Kapsam listesi verilmezse hiçbir project skill yüklenmez.
const noScopes = createSkillRegistry({ project: [manifest({ projectScope: 'scope-a' })] });
assert.equal(noScopes.size, 0);
assert.equal(noScopes.rejected()[0].error, 'SKILL_PROJECT_SCOPE_NOT_ALLOWED');

// Registry sınırını aşan skill'ler sessizce eklenmez.
const overflow = createSkillRegistry({
  builtin: Array.from({ length: SKILL_REGISTRY_LIMITS.maxSkills + 2 }, (_, i) => manifest({ name: `skill-${i}` }))
});
assert.equal(overflow.size, SKILL_REGISTRY_LIMITS.maxSkills);
assert.deepEqual(overflow.rejected().map(({ error }) => error), ['SKILL_LIMIT_EXCEEDED', 'SKILL_LIMIT_EXCEEDED']);

for (const input of [{ builtin: 'skill' }, { user: 1 }, { project: {} }]) {
  assert.throws(() => createSkillRegistry(input), /INVALID_SKILL_REGISTRY/);
}
for (const allowedProjectScopes of ['scope-a', [''], [42], Array.from({ length: 33 }, (_, i) => `s${i}`)]) {
  assert.throws(() => createSkillRegistry({ allowedProjectScopes }), /INVALID_SKILL_REGISTRY:allowedProjectScopes/);
}

// Execution çözümü ajan policy'sini genişletemez; onay ayrı ve açık kalır.
const wide = createSkillRegistry({
  builtin: [manifest({ name: 'wide-skill', allowedTools: ['runtime.status', 'external.write', 'pr.comment', 'connector.canva.read'] })]
});
const resolved = resolveSkillExecution(wide, { name: 'wide-skill', agent });
assert.equal(resolved.ok, true);
assert.deepEqual(resolved.skill.tools, ['runtime.status']);
assert.deepEqual(resolved.skill.approvalRequiredTools, ['external.write']);
assert.deepEqual(resolved.skill.deniedTools, ['pr.comment', 'connector.canva.read']);
assert.equal('projectScope' in resolved.skill, false);
for (const frozen of [resolved.skill, resolved.skill.tools]) assert.equal(Object.isFrozen(frozen), true);

// Fork execution yalnız delegasyon yetkisi olan ajanda çalışır.
const forkRegistry = createSkillRegistry({ builtin: [manifest({ name: 'fork-skill', execution: 'fork' })] });
assert.equal(resolveSkillExecution(forkRegistry, { name: 'fork-skill', agent }).ok, true);
const noDelegateAgent = { id: 'reviewer', toolPolicy: { default: 'deny', allow: ['runtime.status'] } };
assert.deepEqual(resolveSkillExecution(forkRegistry, { name: 'fork-skill', agent: noDelegateAgent }), { ok: false, error: 'SKILL_FORK_NOT_AUTHORIZED' });
assert.deepEqual(resolveSkillExecution(forkRegistry, { name: 'missing', agent }), { ok: false, error: 'SKILL_NOT_FOUND' });
assert.throws(() => resolveSkillExecution(null, { name: 'fork-skill', agent }), /INVALID_SKILL_REGISTRY:registry/);
assert.throws(() => resolveSkillExecution(forkRegistry, { name: 'fork-skill' }), /INVALID_SKILL_REGISTRY:agent/);

console.log('skill registry tests passed');
