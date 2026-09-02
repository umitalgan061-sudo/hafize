import assert from 'node:assert/strict';
import {
  SKILL_SOURCE_PRIORITY,
  findSkillsByTrigger,
  listPublicSkills,
  loadSkillRegistry,
  resolveSkillForAgent
} from '../lib/skill-registry.mjs';

function manifest(overrides = {}) {
  return {
    id: 'ozet',
    name: 'Özet',
    description: 'Uzun metni kısaltır.',
    triggers: ['özetle'],
    allowedTools: ['task.read'],
    prompt: 'Metni kısa ve doğru biçimde özetle.',
    ...overrides
  };
}

const agent = {
  toolPolicy: {
    default: 'deny',
    allow: ['task.read', 'repo.read'],
    deny: ['connector.gmail.read'],
    approvalRequired: ['external.write']
  }
};

const registry = loadSkillRegistry(
  [
    { source: 'builtin', manifest: manifest({ prompt: 'builtin özet' }) },
    { source: 'user', manifest: manifest({ prompt: 'user özet' }) },
    {
      source: 'project',
      scope: 'umitalgan061-sudo/hafize',
      manifest: manifest({ id: 'pr-notu', triggers: ['pr notu'], allowedTools: ['repo.read', 'connector.gmail.read'] })
    }
  ],
  { allowedProjectScopes: ['umitalgan061-sudo/hafize'] }
);

assert.equal(registry.skills.size, 2);
assert.equal(registry.skills.get('ozet').source, 'user', 'user skill builtin skill üzerine yazar');
assert.equal(registry.skills.get('ozet').prompt, 'user özet');
assert.equal(registry.skills.get('ozet').scope, null);
assert.equal(registry.skills.get('pr-notu').scope, 'umitalgan061-sudo/hafize');
assert.deepEqual(SKILL_SOURCE_PRIORITY, { builtin: 0, user: 1, project: 2 });

const publicSkills = listPublicSkills(registry);
assert.deepEqual(
  publicSkills.map(({ id, source }) => [id, source]),
  [
    ['ozet', 'user'],
    ['pr-notu', 'project']
  ]
);
assert.equal(publicSkills.every((skill) => !('prompt' in skill)), true, 'public projeksiyon prompt sızdırmaz');

assert.deepEqual(findSkillsByTrigger(registry, 'Bunu ÖZETLE lütfen'), ['ozet']);
assert.deepEqual(findSkillsByTrigger(registry, 'ilgisiz istek'), []);
assert.deepEqual(findSkillsByTrigger(registry, '   '), []);

const resolved = resolveSkillForAgent(registry, 'pr-notu', agent);
assert.equal(resolved.ok, true);
assert.deepEqual(resolved.value.allowedTools, ['repo.read']);
assert.deepEqual(resolved.value.deniedTools, [{ permission: 'connector.gmail.read', reason: 'explicit_deny' }]);
assert.equal(resolved.value.execution, 'inline');
assert.equal(Object.isFrozen(resolved.value), true);
assert.equal(resolveSkillForAgent(registry, 'yok-boyle', agent).error, 'UNKNOWN_SKILL');

const escalating = loadSkillRegistry([
  { source: 'user', manifest: manifest({ id: 'yukselt', allowedTools: ['runtime.status', 'repo.read'] }) }
]);
assert.deepEqual(
  resolveSkillForAgent(escalating, 'yukselt', agent).value.deniedTools,
  [{ permission: 'runtime.status', reason: 'default_deny' }],
  'skill kendi tool yetkisini ajan politikasının üstüne çıkaramaz'
);

assert.throws(
  () => loadSkillRegistry([{ source: 'project', scope: 'baska/proje', manifest: manifest() }], { allowedProjectScopes: [] }),
  /SKILL_PROJECT_SCOPE_NOT_ALLOWED/
);
assert.throws(() => loadSkillRegistry([{ source: 'project', manifest: manifest() }], { allowedProjectScopes: ['a/b'] }), /INVALID_SKILL_SCOPE/);
assert.throws(() => loadSkillRegistry([{ source: 'user', scope: 'a/b', manifest: manifest() }]), /INVALID_SKILL_SCOPE/);
assert.throws(
  () => loadSkillRegistry([{ source: 'user', manifest: manifest() }, { source: 'user', manifest: manifest() }]),
  /SKILL_ID_CONFLICT:ozet/
);
for (const entry of [null, 'skill', { source: 'user', manifest: manifest(), path: '/etc/passwd' }]) {
  assert.throws(() => loadSkillRegistry([entry]), /INVALID_SKILL_REGISTRY_ENTRY/);
}
for (const entries of ['x', Array.from({ length: 101 }, () => ({ source: 'user', manifest: manifest() }))]) {
  assert.throws(() => loadSkillRegistry(entries), /INVALID_SKILL_REGISTRY/);
}

console.log('skill registry tests passed');
