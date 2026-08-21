import assert from 'node:assert/strict';
import {
  SKILL_SOURCE_PRECEDENCE,
  createSkillRegistry,
  listPublicSkills,
  resolveSkillInvocation
} from '../lib/skill-registry.mjs';

assert.deepEqual(SKILL_SOURCE_PRECEDENCE, ['builtin', 'user', 'project']);

const manifest = (id, overrides = {}) => ({
  id,
  name: `Skill ${id}`,
  description: `${id} açıklaması.`,
  execution: 'inline',
  allowedTools: ['runtime.status'],
  prompt: `${id} görevini yerine getir.`,
  ...overrides
});

const agent = {
  id: 'hafize-general',
  toolPolicy: { default: 'deny', allow: ['runtime.status', 'repo.read'], deny: ['connector.gmail.read'] }
};

const registry = createSkillRegistry(
  [
    { source: 'builtin', manifests: [manifest('repo-summary'), manifest('note-taker', { execution: 'fork' })] },
    { source: 'user', manifests: [manifest('daily-brief')] },
    { source: 'project', scope: 'hafize', manifests: [manifest('release-notes')] }
  ],
  { allowedProjectScopes: ['hafize'] }
);

assert.equal(registry.size, 4);
assert.deepEqual(registry.shadowed, []);
assert.equal(registry.get('repo-summary').source, 'builtin');
assert.equal(registry.get('release-notes').scope, 'hafize');
assert.equal(registry.get('daily-brief').scope, null);
for (const id of ['missing', '', null]) assert.equal(registry.get(id), null);

const publicSkills = listPublicSkills(registry);
assert.deepEqual(publicSkills.map((item) => item.id), ['repo-summary', 'note-taker', 'daily-brief', 'release-notes']);
assert.deepEqual(publicSkills[0], {
  id: 'repo-summary', name: 'Skill repo-summary', description: 'repo-summary açıklaması.',
  triggers: [], execution: 'inline', source: 'builtin'
});
for (const item of publicSkills) assert.equal('prompt' in item, false);

// Builtin skills keep priority; a user or project skill can never shadow them silently.
const shadowRegistry = createSkillRegistry(
  [
    { source: 'project', scope: 'hafize', manifests: [manifest('repo-summary', { prompt: 'Proje sürümü.' })] },
    { source: 'builtin', manifests: [manifest('repo-summary', { prompt: 'Builtin sürümü.' })] },
    { source: 'user', manifests: [manifest('daily-brief')] }
  ],
  { allowedProjectScopes: ['hafize'] }
);
assert.equal(shadowRegistry.size, 2);
assert.equal(shadowRegistry.get('repo-summary').source, 'builtin');
assert.equal(shadowRegistry.get('repo-summary').skill.prompt, 'Builtin sürümü.');
assert.deepEqual(shadowRegistry.shadowed, [{ id: 'repo-summary', source: 'project', shadowedBy: 'builtin' }]);

// Project skills load only from an explicitly allowed scope.
assert.throws(
  () => createSkillRegistry([{ source: 'project', scope: 'other-repo', manifests: [manifest('x-skill')] }], {
    allowedProjectScopes: ['hafize']
  }),
  /SKILL_PROJECT_SCOPE_NOT_ALLOWED:other-repo/
);
for (const scope of [undefined, '', 'UPPER', '../escape']) {
  assert.throws(
    () => createSkillRegistry([{ source: 'project', scope, manifests: [manifest('x-skill')] }], {
      allowedProjectScopes: ['hafize', 'UPPER', '../escape']
    }),
    /INVALID_SKILL_SOURCE:scope/
  );
}
assert.throws(() => createSkillRegistry([{ source: 'builtin', scope: 'hafize', manifests: [] }]), /INVALID_SKILL_SOURCE:scope/);
for (const sources of [null, 'builtin', [null], [{ source: 'plugin', manifests: [] }], [{ source: 'user' }]]) {
  assert.throws(() => createSkillRegistry(sources), /INVALID_SKILL_SOURCE/);
}
assert.throws(
  () => createSkillRegistry([{ source: 'user', manifests: [manifest('dup'), manifest('dup')] }]),
  /SKILL_REGISTRY_DUPLICATE:dup/
);
assert.throws(
  () => createSkillRegistry([{ source: 'user', manifests: Array.from({ length: 65 }, (_, i) => manifest(`skill-${i}`)) }]),
  /SKILL_REGISTRY_LIMIT_EXCEEDED/
);

// Invocation resolves through the agent policy, never around it.
const resolved = resolveSkillInvocation(registry, 'note-taker', { agent });
assert.equal(resolved.ok, true);
assert.deepEqual(resolved.invocation, {
  id: 'note-taker', source: 'builtin', execution: 'fork', model: 'default',
  tools: ['runtime.status'], prompt: 'note-taker görevini yerine getir.', arguments: []
});
assert.equal(Object.isFrozen(resolved.invocation), true);
assert.deepEqual(resolveSkillInvocation(registry, 'missing', { agent }), { ok: false, error: 'SKILL_NOT_FOUND' });
assert.equal(resolveSkillInvocation(registry, 'repo-summary', {}).error, 'INVALID_SKILL_AGENT');

const gmailRegistry = createSkillRegistry([
  { source: 'user', manifests: [manifest('inbox-triage', { allowedTools: ['connector.gmail.read'] })] }
]);
const deniedByAgent = resolveSkillInvocation(gmailRegistry, 'inbox-triage', { agent });
assert.deepEqual(
  [deniedByAgent.ok, deniedByAgent.error, deniedByAgent.reason],
  [false, 'SKILL_TOOL_NOT_AUTHORIZED:connector.gmail.read', 'explicit_deny']
);

// Approval-gated permissions cannot reach a skill even when the caller holds approval.
assert.throws(
  () => createSkillRegistry([{ source: 'user', manifests: [manifest('push-skill', { allowedTools: ['external.write'] })] }]),
  /SKILL_PERMISSION_REQUIRES_APPROVAL/
);

console.log('skill registry tests passed');
