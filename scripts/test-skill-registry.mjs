import assert from 'node:assert/strict';
import { createSkillRegistry, listPublicSkills, resolveSkillExecution } from '../lib/skill-registry.mjs';

const agent = {
  id: 'hafize-general',
  toolPolicy: { default: 'deny', allow: ['runtime.status', 'connector.gmail.read'], deny: ['connector.canva.read'], approvalRequired: ['external.write'] }
};
const manifest = (overrides = {}) => ({ id: 'daily-brief', name: 'Günlük özet', description: 'Günü özetler.', prompt: 'Kullanıcının gününü özetle.', ...overrides });
const note = (overrides = {}) => manifest({ id: 'not-al', name: 'Not al', prompt: 'Kısa not al.', ...overrides });

const registry = createSkillRegistry([
  { source: 'builtin', manifest: manifest({ allowedTools: ['runtime.status', 'connector.canva.read', 'repo.read'] }) },
  { source: 'user', manifest: note({ execution: 'fork' }) }
]);
assert.equal(Object.isFrozen(registry) && Object.isFrozen(registry.skills), true);
assert.deepEqual(registry.skills.map((skill) => skill.id), ['daily-brief', 'not-al']);
assert.deepEqual(registry.shadowed, []);

// Public listede prompt ve araç talebi sızmaz.
const listed = listPublicSkills(registry);
assert.deepEqual(Object.keys(listed[0]), ['id', 'name', 'description', 'source', 'execution', 'triggers']);

// Kaynak önceliği: düşük güvenli kaynak yüksek güvenli kaynağı gölgeleyemez.
const shadowRegistry = createSkillRegistry(
  [
    { source: 'project', manifest: manifest({ prompt: 'Proje sürümü.' }) },
    { source: 'builtin', manifest: manifest({ prompt: 'Builtin sürümü.' }) },
    { source: 'user', manifest: note() },
    { source: 'project', manifest: note({ prompt: 'Proje notu.' }) }
  ],
  { projectScopeAllowed: true }
);
assert.equal(shadowRegistry.skills.find((skill) => skill.id === 'daily-brief').prompt, 'Builtin sürümü.');
assert.equal(shadowRegistry.skills.find((skill) => skill.id === 'not-al').source, 'user');
assert.deepEqual(shadowRegistry.shadowed, [
  { id: 'daily-brief', source: 'project', shadowedBy: 'builtin' },
  { id: 'not-al', source: 'project', shadowedBy: 'user' }
]);

// Aynı kaynakta çakışan kimlik sessizce ezilmez; project kapsamı açık izin ister.
assert.throws(() => createSkillRegistry([{ source: 'user', manifest: manifest() }, { source: 'user', manifest: manifest() }]), /SKILL_ID_DUPLICATE:daily-brief/);
assert.throws(() => createSkillRegistry([{ source: 'project', manifest: manifest() }]), /SKILL_PROJECT_SCOPE_NOT_ALLOWED/);
for (const entries of ['x', [null], [{ source: 'user' }]]) assert.throws(() => createSkillRegistry(entries), /INVALID_SKILL/);

// Yetki: yalnız agent policy'nin izin verdiği araçlar kalır, gerekçe görünür olur.
const plan = resolveSkillExecution(registry, { skillId: 'daily-brief', agent });
assert.deepEqual(plan.tools, ['runtime.status']);
assert.deepEqual(plan.deniedTools, [
  { tool: 'connector.canva.read', reason: 'explicit_deny' },
  { tool: 'repo.read', reason: 'default_deny' }
]);
assert.deepEqual(plan.promptMessage, { role: 'user', content: 'Kullanıcının gününü özetle.' });
assert.equal(Object.isFrozen(plan) && !('prompt' in plan), true);

// Fork execution yalnız fork imkânı açıkken çalışır.
assert.throws(() => resolveSkillExecution(registry, { skillId: 'not-al', agent }), /SKILL_FORK_NOT_AVAILABLE/);
assert.equal(resolveSkillExecution(registry, { skillId: 'not-al', agent, forkAvailable: true }).execution, 'fork');
assert.throws(() => resolveSkillExecution(registry, { skillId: 'yok', agent }), /SKILL_NOT_FOUND/);

// Argüman sözleşmesi: zorunlu alan gerekli, bilinmeyen argüman reddedilir.
const argRegistry = createSkillRegistry([
  { source: 'builtin', manifest: manifest({ arguments: [{ name: 'gun', description: 'Gün.', required: true }, { name: 'not', description: 'Ek not.' }] }) }
]);
const resolveArgs = (args) => resolveSkillExecution(argRegistry, { skillId: 'daily-brief', agent, args });
assert.deepEqual(resolveArgs({ gun: 'bugün' }).arguments, { gun: 'bugün' });
assert.deepEqual(resolveArgs({ gun: 'bugün', not: 'kısa tut' }).arguments, { gun: 'bugün', not: 'kısa tut' });
assert.throws(() => resolveArgs({}), /MISSING_SKILL_ARGUMENT:gun/);
assert.throws(() => resolveArgs({ gun: 'x', tool: 'shell' }), /UNKNOWN_SKILL_ARGUMENT:tool/);
assert.throws(() => resolveArgs('gun'), /INVALID_SKILL_ARGUMENT_VALUES/);
for (const value of [42, '\0', 'x'.repeat(2_001)]) assert.throws(() => resolveArgs({ gun: value }), /INVALID_SKILL_ARGUMENT_VALUE:gun/);

console.log('skill registry tests passed');
