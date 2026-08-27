import assert from 'node:assert/strict';
import { SKILL_SOURCE_PRIORITY, createSkillRegistry } from '../lib/skill-registry.mjs';

const agent = {
  id: 'hafize-general',
  toolPolicy: {
    default: 'deny',
    allow: ['repo.read', 'runtime.status'],
    approvalRequired: ['external.write']
  }
};

function manifest(overrides = {}) {
  return {
    name: 'repo-ozet',
    description: 'Depo yapısını özetler.',
    allowedTools: ['repo.read', 'connector.gmail.read'],
    prompt: 'Depoyu salt-okunur incele.',
    ...overrides
  };
}

assert.deepEqual(SKILL_SOURCE_PRIORITY, { builtin: 3, user: 2, project: 1 });

const registry = createSkillRegistry({ allowedProjectScopes: ['umitalgan061-sudo/hafize'] });
const builtin = registry.register(manifest(), { source: 'builtin' });
assert.equal(builtin.source, 'builtin');
assert.equal(builtin.projectScope, null);
assert.equal(registry.size, 1);

// Aynı öncelikli tekrar ve düşük öncelikli gölgeleme reddedilir.
assert.throws(() => registry.register(manifest(), { source: 'builtin' }), /SKILL_REGISTRY_DUPLICATE/);
assert.throws(() => registry.register(manifest(), { source: 'user' }), /SKILL_REGISTRY_SHADOWED/);
assert.throws(
  () => registry.register(manifest(), { source: 'project', projectScope: 'umitalgan061-sudo/hafize' }),
  /SKILL_REGISTRY_SHADOWED/
);
assert.equal(registry.resolve('repo-ozet').source, 'builtin');

// Yüksek öncelikli kaynak düşük öncelikliyi devralır.
const layered = createSkillRegistry({ allowedProjectScopes: ['umitalgan061-sudo/hafize'] });
layered.register(manifest({ description: 'Proje sürümü.' }), {
  source: 'project',
  projectScope: 'umitalgan061-sudo/hafize'
});
assert.equal(layered.resolve('repo-ozet').source, 'project');
assert.equal(layered.resolve('repo-ozet').projectScope, 'umitalgan061-sudo/hafize');
layered.register(manifest({ description: 'Kullanıcı sürümü.' }), { source: 'user' });
assert.equal(layered.resolve('repo-ozet').source, 'user');
assert.equal(layered.resolve('repo-ozet').projectScope, null);
assert.equal(layered.size, 1);

// Proje kapsamı yalnız açıkça izin verilen kapsamdan yüklenir.
assert.throws(
  () => layered.register(manifest({ name: 'baska-skill' }), { source: 'project', projectScope: 'baska/repo' }),
  /SKILL_PROJECT_SCOPE_NOT_ALLOWED/
);
for (const projectScope of [undefined, null, '', 'bir kapsam']) {
  assert.throws(
    () => layered.register(manifest({ name: 'baska-skill' }), { source: 'project', projectScope }),
    /INVALID_SKILL_PROJECT_SCOPE/
  );
}
assert.throws(
  () => layered.register(manifest({ name: 'baska-skill' }), { source: 'user', projectScope: 'umitalgan061-sudo/hafize' }),
  /INVALID_SKILL_PROJECT_SCOPE/
);
const scopeless = createSkillRegistry();
assert.throws(
  () => scopeless.register(manifest(), { source: 'project', projectScope: 'umitalgan061-sudo/hafize' }),
  /SKILL_PROJECT_SCOPE_NOT_ALLOWED/
);
assert.throws(() => createSkillRegistry({ allowedProjectScopes: 'hepsi' }), /INVALID_SKILL_PROJECT_SCOPES/);
assert.throws(() => createSkillRegistry({ allowedProjectScopes: ['iki kapsam'] }), /INVALID_SKILL_PROJECT_SCOPES/);

// Skill kendi tool yetkisini yükseltemez; ajan politikası tavan kalır.
const resolved = registry.resolveForAgent(agent, 'REPO-OZET ');
assert.deepEqual(resolved.tools, ['repo.read']);
assert.deepEqual(resolved.deniedTools, [{ permission: 'connector.gmail.read', reason: 'default_deny' }]);
assert.equal(resolved.execution, 'inline');
assert.equal(Object.isFrozen(resolved), true);
assert.equal(Object.isFrozen(resolved.tools), true);
assert.equal('allowedTools' in resolved, false);
assert.equal('projectScope' in resolved, false);

const narrowAgent = { id: 'narrow', toolPolicy: { default: 'deny', allow: [] } };
assert.deepEqual(registry.resolveForAgent(narrowAgent, 'repo-ozet').tools, []);
assert.throws(() => registry.resolveForAgent(agent, 'yok-boyle-skill'), /SKILL_NOT_FOUND/);

// Onay gerektiren izinler yalnız onayla açılır ve manifestte doğrudan tanımlanamaz.
const approvalRegistry = createSkillRegistry();
assert.throws(
  () => approvalRegistry.register(manifest({ allowedTools: ['external.write'] }), { source: 'builtin' }),
  /SKILL_APPROVAL_PERMISSION_NOT_DECLARABLE/
);

// list() prompt veya izin sızdırmaz.
registry.register(manifest({ name: 'not-al', description: 'Not alır.', allowedTools: [] }), { source: 'user' });
const listed = registry.list();
assert.deepEqual(listed.map((item) => item.name), ['not-al', 'repo-ozet']);
for (const item of listed) {
  assert.deepEqual(Object.keys(item).sort(), ['description', 'execution', 'name', 'source', 'triggers']);
}

console.log('skill registry tests passed');
