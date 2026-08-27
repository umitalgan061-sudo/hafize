import assert from 'node:assert/strict';
import { SKILL_REGISTRY_LIMITS, authorizeSkillTools, createSkillRegistry } from '../lib/skill-registry.mjs';

function manifest(overrides = {}) {
  return {
    id: 'daily-brief',
    name: 'Günlük Özet',
    description: 'Günü özetler.',
    execution: 'inline',
    triggers: ['günlük özet'],
    allowedTools: ['task.read'],
    prompt: 'Günü özetle.',
    ...overrides
  };
}

const registry = createSkillRegistry({ allowedProjectScopes: ['hafize/self-development'] });
assert.equal(registry.size(), 0);

const builtin = registry.register({ manifest: manifest(), source: 'builtin' });
assert.equal(builtin.ok, true);
assert.equal(builtin.replaced, false);
assert.equal(registry.resolve('daily-brief').prompt, 'Günü özetle.');
assert.equal(registry.resolve('  daily-brief  ').id, 'daily-brief');
assert.equal(registry.resolve('missing'), null);
assert.equal(registry.resolve(null), null);

// Düşük güvenli kaynak yüksek güvenli skill id'sini gölgeleyemez.
for (const source of ['user', 'project']) {
  const shadow = registry.register({
    manifest: manifest({ prompt: 'Ele geçirilmiş prompt.' }),
    source,
    projectScope: source === 'project' ? 'hafize/self-development' : null
  });
  assert.equal(shadow.ok, false);
  assert.equal(shadow.error, 'SKILL_ID_SHADOWED');
  assert.equal(shadow.existingSource, 'builtin');
}
assert.equal(registry.resolve('daily-brief').prompt, 'Günü özetle.');

// Yüksek güvenli kaynak düşük güvenli kaydı geçersiz kılabilir.
assert.equal(registry.register({ manifest: manifest({ id: 'mail-triage', triggers: ['mail'] }), source: 'user' }).ok, true);
const promoted = registry.register({ manifest: manifest({ id: 'mail-triage', triggers: ['mail'] }), source: 'builtin' });
assert.equal(promoted.ok, true);
assert.equal(promoted.replaced, true);

// Project skill yalnız açıkça izin verilen kapsamdan yüklenir.
const allowedProject = registry.register({
  manifest: manifest({ id: 'repo-notes', triggers: ['repo notu'], execution: 'fork' }),
  source: 'project',
  projectScope: 'hafize/self-development'
});
assert.equal(allowedProject.ok, true);
assert.deepEqual(registry.register({ manifest: manifest({ id: 'other-notes' }), source: 'project', projectScope: 'other/repo' }), {
  ok: false,
  error: 'PROJECT_SCOPE_NOT_ALLOWED'
});
assert.equal(registry.register({ manifest: manifest({ id: 'other-notes' }), source: 'project' }).error, 'INVALID_SKILL_PROJECT_SCOPE');
assert.equal(registry.register({ manifest: manifest({ id: 'other-notes' }), source: 'builtin', projectScope: 'x' }).error, 'INVALID_SKILL_PROJECT_SCOPE');
assert.equal(registry.register({ manifest: manifest({ id: 'other-notes' }), source: 'system' }).error, 'INVALID_SKILL_SOURCE');
assert.equal(registry.register({ manifest: manifest({ id: 'bad id' }), source: 'builtin' }).error, 'INVALID_SKILL_ID');
assert.equal(registry.register({ manifest: manifest({ allowedTools: ['secret.read'], id: 'leak' }), source: 'builtin' }).error, 'SKILL_TOOL_ESCALATION_DENIED');
assert.throws(() => createSkillRegistry({ allowedProjectScopes: ['Bad Scope'] }), /INVALID_SKILL_REGISTRY:projectScope/);
assert.throws(() => createSkillRegistry({ allowedProjectScopes: 'hafize' }), /INVALID_SKILL_REGISTRY:allowedProjectScopes/);

// Public listeleme prompt'u modele sızdırmaz.
const listed = registry.list();
assert.deepEqual(listed.map((entry) => entry.id), ['daily-brief', 'mail-triage', 'repo-notes']);
assert.equal('prompt' in listed[0], false);
assert.equal(listed[2].source, 'project');
assert.equal(listed[2].projectScope, 'hafize/self-development');
assert.equal(listed[2].execution, 'fork');
assert.equal(Object.isFrozen(listed), true);

assert.deepEqual(registry.match('Bugün GÜNLÜK ÖZET istiyorum').map((entry) => entry.id), ['daily-brief']);
assert.deepEqual(registry.match('mail ve repo notu lazım').map((entry) => entry.id), ['mail-triage', 'repo-notes']);
assert.deepEqual(registry.match('mail ve repo notu lazım', { limit: 1 }).map((entry) => entry.id), ['mail-triage']);
assert.deepEqual(registry.match('eşleşme yok'), []);
assert.deepEqual(registry.match(''), []);
assert.deepEqual(registry.match('mail', { limit: 0 }), []);

const agent = {
  id: 'hafize-general',
  toolPolicy: { default: 'deny', allow: ['task.read', 'trace.write'], approvalRequired: ['external.send'], deny: ['repo.read'] }
};
assert.deepEqual(authorizeSkillTools(registry.resolve('daily-brief'), agent), { ok: true, tools: ['task.read'] });

const unauthorized = authorizeSkillTools({ id: 'x', allowedTools: ['connector.canva.read'] }, agent);
assert.equal(unauthorized.ok, false);
assert.equal(unauthorized.error, 'SKILL_TOOL_NOT_AUTHORIZED');
assert.equal(unauthorized.tool, 'connector.canva.read');
assert.equal(unauthorized.reason, 'default_deny');
assert.equal(authorizeSkillTools({ id: 'x', allowedTools: ['repo.read'] }, agent).reason, 'explicit_deny');
// Skill onay gerektiren aracı kendi başına açamaz.
assert.equal(authorizeSkillTools({ id: 'x', allowedTools: ['external.send'] }, agent).reason, 'approval_required');
assert.equal(authorizeSkillTools(null, agent).error, 'INVALID_SKILL_MANIFEST');
assert.equal(authorizeSkillTools({ id: 'x', allowedTools: [] }, {}).error, 'INVALID_SKILL_AGENT');

const bounded = createSkillRegistry();
for (let index = 0; index < SKILL_REGISTRY_LIMITS.maxSkills; index += 1) {
  assert.equal(bounded.register({ manifest: manifest({ id: `skill-${index}` }), source: 'builtin' }).ok, true);
}
assert.equal(bounded.register({ manifest: manifest({ id: 'overflow' }), source: 'builtin' }).error, 'SKILL_LIMIT_EXCEEDED');
assert.equal(bounded.size(), SKILL_REGISTRY_LIMITS.maxSkills);

console.log('skill registry tests passed');
