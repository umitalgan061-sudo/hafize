import assert from 'node:assert/strict';
import { createSkillRegistry } from '../lib/skill-registry.mjs';

function manifest(overrides = {}) {
  return {
    name: 'rapor-ozeti',
    description: 'Uzun raporları kısa özetlere dönüştürür.',
    triggers: ['rapor özetle'],
    allowedTools: ['task.read'],
    execution: 'inline',
    source: 'builtin',
    prompt: 'Raporu özetle.',
    ...overrides
  };
}

const agent = {
  id: 'hafize-general',
  toolPolicy: { default: 'deny', allow: ['task.read', 'trace.write'], approvalRequired: ['external.write'] }
};

const registry = createSkillRegistry([
  manifest(),
  manifest({ name: 'commit-notu', triggers: ['commit mesajı'], prompt: 'Commit mesajı öner.' })
]);

assert.deepEqual(registry.list().map((skill) => skill.name), ['commit-notu', 'rapor-ozeti']);
assert.equal('prompt' in registry.list()[0], false);
assert.equal(Object.isFrozen(registry.list()[0]), true);
assert.equal(registry.get('rapor-ozeti').prompt, 'Raporu özetle.');
assert.equal(registry.get('yok'), null);
assert.deepEqual(registry.shadowed, []);

assert.deepEqual(registry.match('Lütfen bu RAPOR ÖZETLE komutunu çalıştır').map((skill) => skill.name), ['rapor-ozeti']);
assert.deepEqual(registry.match('alakasız istek'), []);
assert.deepEqual(registry.match(''), []);
assert.deepEqual(registry.match(null), []);

const layered = createSkillRegistry(
  [
    manifest({ prompt: 'builtin sürümü.' }),
    manifest({ source: 'user', prompt: 'user sürümü.' }),
    manifest({ source: 'project', project: 'hafize/app', prompt: 'project sürümü.' })
  ],
  { allowedProjects: ['Hafize/App'] }
);
assert.equal(layered.get('rapor-ozeti').source, 'project');
assert.equal(layered.get('rapor-ozeti').prompt, 'project sürümü.');
assert.deepEqual(layered.shadowed, [
  { name: 'rapor-ozeti', source: 'builtin', shadowedBy: 'user' },
  { name: 'rapor-ozeti', source: 'user', shadowedBy: 'project' }
]);

assert.throws(
  () => createSkillRegistry([manifest({ source: 'project', project: 'baska/proje' })]),
  /SKILL_PROJECT_NOT_ALLOWED/
);
assert.throws(
  () => createSkillRegistry([manifest({ source: 'project', project: 'hafize/app' })], { allowedProjects: ['diger/app'] }),
  /SKILL_PROJECT_NOT_ALLOWED/
);
assert.throws(() => createSkillRegistry([manifest(), manifest()]), /DUPLICATE_SKILL_NAME/);
assert.throws(() => createSkillRegistry('skills'), /INVALID_SKILL_REGISTRY/);
assert.throws(() => createSkillRegistry([], { allowedProjects: 'hafize' }), /INVALID_SKILL_REGISTRY_PROJECTS/);
assert.throws(() => createSkillRegistry([manifest({ name: 'Rapor' })]), /INVALID_SKILL_NAME/);

const authorized = registry.authorize('rapor-ozeti', agent);
assert.equal(authorized.ok, true);
assert.deepEqual(authorized.skill, {
  name: 'rapor-ozeti',
  execution: 'inline',
  model: null,
  prompt: 'Raporu özetle.',
  tools: ['task.read']
});
assert.equal(Object.isFrozen(authorized.skill), true);

assert.deepEqual(registry.authorize('yok', agent), { ok: false, error: 'SKILL_NOT_FOUND' });
assert.deepEqual(registry.authorize('rapor-ozeti', null), { ok: false, error: 'SKILL_AGENT_REQUIRED' });

const restricted = { id: 'agency-orchestrator', toolPolicy: { default: 'deny', allow: ['trace.write'] } };
assert.deepEqual(registry.authorize('rapor-ozeti', restricted), { ok: false, error: 'SKILL_TOOL_NOT_AUTHORIZED' });

const approvalRegistry = createSkillRegistry([manifest({ allowedTools: ['connector.gmail.read'] })]);
assert.deepEqual(approvalRegistry.authorize('rapor-ozeti', agent), { ok: false, error: 'SKILL_TOOL_NOT_AUTHORIZED' });

console.log('skill registry tests passed');
