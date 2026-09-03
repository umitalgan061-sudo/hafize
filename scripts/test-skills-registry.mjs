import assert from 'node:assert/strict';
import {
  SKILL_SOURCE_PRECEDENCE,
  authorizeSkillTools,
  listPublicSkills,
  loadSkillRegistry,
  resolveSkill
} from '../lib/skills-registry.mjs';

assert.deepEqual(SKILL_SOURCE_PRECEDENCE, ['builtin', 'user', 'project']);

function manifest(overrides = {}) {
  return {
    id: 'release-notes',
    name: 'Release Notes',
    description: 'Sürüm notu taslağı üretir.',
    source: 'builtin',
    triggers: ['sürüm notu'],
    allowedTools: ['repo.read'],
    execution: 'inline',
    ...overrides
  };
}

const loaded = loadSkillRegistry({
  manifests: [manifest(), manifest({ id: 'pr-triage', source: 'user', allowedTools: ['pr.read'] })]
});
assert.equal(loaded.ok, true);
assert.equal(loaded.registry.skills.length, 2);
assert.deepEqual(loaded.registry.shadowed, []);
assert.equal(resolveSkill(loaded.registry, 'pr-triage').source, 'user');
assert.equal(resolveSkill(loaded.registry, 'missing'), null);
assert.deepEqual(listPublicSkills(loaded.registry)[0], {
  id: 'release-notes',
  name: 'Release Notes',
  description: 'Sürüm notu taslağı üretir.',
  source: 'builtin',
  execution: 'inline',
  triggers: ['sürüm notu']
});

// A project manifest cannot shadow a builtin skill by reusing its id,
// in either declaration order.
const project = manifest({ source: 'project', projectScope: 'hafize' });
for (const manifests of [[manifest(), project], [project, manifest()]]) {
  const shadowTest = loadSkillRegistry({ manifests, allowedProjectScopes: ['hafize'] });
  assert.equal(shadowTest.ok, true);
  assert.equal(shadowTest.registry.skills.length, 1);
  assert.equal(shadowTest.registry.skills[0].source, 'builtin');
  assert.deepEqual(shadowTest.registry.shadowed, [{ id: 'release-notes', source: 'project' }]);
}

const rejected = [
  // project skills load only from explicitly allowed project scopes.
  [{ manifests: [manifest({ source: 'project', projectScope: 'other' })], allowedProjectScopes: ['hafize'] },
    'SKILL_PROJECT_SCOPE_NOT_ALLOWED'],
  [{ manifests: [project] }, 'SKILL_PROJECT_SCOPE_NOT_ALLOWED'],
  // one invalid or duplicated manifest fails the whole load.
  [{ manifests: [manifest(), manifest()] }, 'INVALID_SKILL_REGISTRY:duplicate:release-notes'],
  [{ manifests: [manifest({ execution: 'bypass' })] }, 'INVALID_SKILL_MANIFEST:execution'],
  [{ manifests: 'all' }, 'INVALID_SKILL_REGISTRY:manifests']
];
for (const [input, error] of rejected) {
  assert.deepEqual(loadSkillRegistry(input), { ok: false, error });
}
assert.equal(loadSkillRegistry({ manifests: [] }).ok, true);

// Tool authorization is derived from the agent policy, never from the skill.
const agent = {
  id: 'hafize-general',
  toolPolicy: {
    default: 'deny',
    allow: ['repo.read', 'pr.read'],
    approvalRequired: ['external.write'],
    deny: ['repo.merge']
  }
};

assert.deepEqual(authorizeSkillTools(agent, { id: 'a', allowedTools: ['repo.read', 'external.write'] }), {
  ok: true,
  tools: { allowed: ['repo.read'], approvalRequired: ['external.write'] }
});
assert.deepEqual(authorizeSkillTools(agent, { id: 'a', allowedTools: [] }), {
  ok: true,
  tools: { allowed: [], approvalRequired: [] }
});
for (const [skill, error] of [
  [{ id: 'a', allowedTools: ['repo.merge'] }, 'SKILL_TOOL_ESCALATION:repo.merge'],
  [{ id: 'a', allowedTools: ['task.read'] }, 'SKILL_TOOL_ESCALATION:task.read'],
  [{ id: 'a' }, 'INVALID_SKILL_AUTHORIZATION:skill']
]) {
  assert.deepEqual(authorizeSkillTools(agent, skill), { ok: false, error });
}
assert.deepEqual(authorizeSkillTools(null, { id: 'a', allowedTools: [] }), {
  ok: false,
  error: 'INVALID_SKILL_AUTHORIZATION:agent'
});

console.log('skills registry tests passed');
