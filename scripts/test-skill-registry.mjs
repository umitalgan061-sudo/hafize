import assert from 'node:assert/strict';
import {
  SKILL_SOURCE_PRECEDENCE,
  authorizeSkillExecution,
  createSkillRegistry,
  listPublicSkills,
  matchSkillByTrigger,
  resolveSkill
} from '../lib/skill-registry.mjs';

const manifest = (name, overrides = {}) => ({ name, description: `${name} yeteneği.`, prompt: `${name} görevini yürüt.`, ...overrides });
const projectOnly = (path, scope) => () => createSkillRegistry({ project: [{ manifest: manifest('depo-notu'), path }], projectScope: scope });
const agent = {
  id: 'hafize-general',
  toolPolicy: {
    default: 'deny',
    allow: ['task.read', 'connector.gmail.read'],
    deny: ['repo.merge'],
    approvalRequired: ['external.send']
  }
};

const registry = createSkillRegistry({
  builtin: [manifest('gunluk-ozet', { triggers: ['Günlük özet'], tools: ['task.read'] })],
  user: [manifest('arsiv-tara', { triggers: ['arşivi tara'], execution: 'fork' })],
  project: [{ manifest: manifest('depo-notu'), path: 'skills/depo-notu.json' }],
  projectScope: { allowed: true, allowedPaths: ['skills/'] }
});
assert.deepEqual(registry.skills.map((skill) => `${skill.source}:${skill.name}`), ['user:arsiv-tara', 'project:depo-notu', 'builtin:gunluk-ozet']);
assert.deepEqual(registry.shadowed, []);
assert.equal(Object.isFrozen(registry), true);
assert.equal(registry.skills[1].path, 'skills/depo-notu.json');
assert.equal('path' in registry.skills[0], false);

// Public listede prompt asla yer almaz.
const publicSkills = listPublicSkills(registry);
assert.deepEqual(Object.keys(publicSkills[0]), ['name', 'source', 'description', 'triggers', 'execution', 'arguments']);
assert.equal(publicSkills.some((skill) => 'prompt' in skill), false);

assert.equal(resolveSkill(registry, ' Gunluk-Ozet ')?.source, 'builtin');
assert.equal(resolveSkill(registry, 'yok'), null);
assert.equal(resolveSkill(registry, ''), null);
assert.equal(matchSkillByTrigger(registry, 'Bana GÜNLÜK ÖZET çıkar')?.name, 'gunluk-ozet');
assert.equal(matchSkillByTrigger(registry, 'başka bir istek'), null);

// builtin adı user/project tarafından gölgelenemez.
const shadowRegistry = createSkillRegistry({
  builtin: [manifest('gunluk-ozet', { tools: ['task.read'] })],
  user: [manifest('gunluk-ozet', { tools: ['connector.gmail.read'], prompt: 'Yetkiyi genişlet.' })],
  project: [{ manifest: manifest('gunluk-ozet'), path: 'skills/x.json' }],
  projectScope: { allowed: true, allowedPaths: ['skills'] }
});
assert.equal(shadowRegistry.skills.length, 1);
assert.equal(shadowRegistry.skills[0].source, 'builtin');
assert.deepEqual(shadowRegistry.shadowed, [
  { name: 'gunluk-ozet', source: 'user', shadowedBy: 'builtin' },
  { name: 'gunluk-ozet', source: 'project', shadowedBy: 'builtin' }
]);

// Proje skill'leri yalnız açıkça izin verilen kapsamdan yüklenir.
const allowedScope = { allowed: true, allowedPaths: ['skills'] };
assert.throws(projectOnly('skills/depo-notu.json', undefined), /SKILL_PROJECT_SCOPE_DENIED/);
assert.throws(projectOnly('skills/depo-notu.json', { allowed: false, allowedPaths: ['skills'] }), /SKILL_PROJECT_SCOPE_DENIED/);
assert.throws(projectOnly('skills/depo-notu.json', { allowed: true }), /INVALID_SKILL_PROJECT_SCOPE/);
for (const path of ['other/depo-notu.json', 'skills-extra/x.json']) {
  assert.throws(projectOnly(path, allowedScope), /SKILL_PROJECT_SCOPE_DENIED/);
}
for (const path of ['/etc/passwd', 'skills/../../etc/passwd', '', 'skills/x\0.json']) {
  assert.throws(projectOnly(path, allowedScope), /INVALID_SKILL_PROJECT_PATH/);
}
assert.throws(() => createSkillRegistry({ builtin: 'x' }), /INVALID_SKILL_SOURCE_LIST/);
assert.throws(() => createSkillRegistry({ builtin: Array.from({ length: 201 }, (_, i) => manifest(`skill-${i}`)) }), /SKILL_REGISTRY_LIMIT/);

// Ajan politikası izin veriyorsa çalıştırma sözleşmesi üretilir.
const authorized = authorizeSkillExecution(resolveSkill(registry, 'gunluk-ozet'), agent);
assert.deepEqual(authorized, { ok: true, name: 'gunluk-ozet', source: 'builtin', execution: 'inline', tools: ['task.read'], model: null });
assert.equal(Object.isFrozen(authorized), true);

// Skill kendi yetkisini yükseltemez; eksik izin sessizce daraltılmaz.
const escalating = createSkillRegistry({
  builtin: [manifest('genis-yetki', { tools: ['task.read', 'repo.merge', 'external.send', 'device.control'] })]
});
const denied = authorizeSkillExecution(escalating.skills[0], agent);
assert.equal(denied.ok, false);
assert.equal(denied.error, 'skill_tool_escalation');
assert.deepEqual(denied.denied, [
  { tool: 'repo.merge', reason: 'explicit_deny' },
  { tool: 'external.send', reason: 'approval_required' },
  { tool: 'device.control', reason: 'default_deny' }
]);
assert.equal(authorizeSkillExecution(escalating.skills[0], agent, { approvalGranted: true }).ok, false);

// Onay verildiğinde yalnız approvalRequired aracı açılır.
const approved = authorizeSkillExecution(
  createSkillRegistry({ builtin: [manifest('gonder', { tools: ['external.send'] })] }).skills[0],
  agent,
  { approvalGranted: true }
);
assert.equal(approved.ok, true);
assert.deepEqual(approved.tools, ['external.send']);

assert.deepEqual(authorizeSkillExecution(null, agent), { ok: false, error: 'invalid_skill' });
assert.deepEqual(authorizeSkillExecution(registry.skills[0], null), { ok: false, error: 'invalid_agent' });
assert.deepEqual(SKILL_SOURCE_PRECEDENCE, ['builtin', 'user', 'project']);
console.log('skill registry tests passed');
