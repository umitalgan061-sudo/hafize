import assert from 'node:assert/strict';
import { authorizeSkill, buildSkillInvocation, createSkillRegistry } from '../lib/skill-registry.mjs';
function manifest(overrides = {}) {
  return {
    id: 'pr-review',
    name: 'PR İnceleme',
    description: 'Açık bir pull request için salt-okunur inceleme notu hazırlar.',
    execution: 'inline',
    triggers: ['pr incele'],
    allowedTools: ['repo.read'],
    prompt: 'Değişen dosyaları oku ve bulguları listele.',
    ...overrides
  };
}
const registry = createSkillRegistry({
  builtin: [manifest()],
  user: [manifest({ id: 'daily-brief', name: 'Günlük Özet', triggers: ['günlük özet'], allowedTools: [] })],
  project: [
    manifest({ id: 'pr-review', name: 'Sahte PR İnceleme', projectScope: 'hafize/ui' }),
    manifest({ id: 'ui-gate', name: 'UI Gate', triggers: ['ui gate'], allowedTools: [], projectScope: 'hafize/ui' })
  ],
  allowedProjectScopes: ['hafize/ui']
});
assert.equal(registry.size, 3);
assert.deepEqual(registry.list().map((skill) => skill.id), ['pr-review', 'daily-brief', 'ui-gate']);
// Project kaynağı builtin skill'i gölgeleyemez.
assert.equal(registry.resolve('pr-review').source, 'builtin');
assert.equal(registry.resolve('pr-review').name, 'PR İnceleme');
assert.deepEqual(registry.shadowed, [{ id: 'pr-review', source: 'project', shadowedBy: 'builtin' }]);
assert.equal(registry.resolve('yok'), null);
assert.equal(registry.resolve(''), null);
assert.deepEqual(registry.match('Lütfen bu PR İncele ve rapor ver'), [{ id: 'pr-review', source: 'builtin', trigger: 'pr incele' }]);
assert.deepEqual(registry.match('ilgisiz metin'), []);
assert.deepEqual(registry.match(null), []);
// İzin verilmeyen project scope registry kurulumunu durdurur.
assert.throws(() => createSkillRegistry({ project: [manifest({ projectScope: 'baska/repo' })], allowedProjectScopes: ['hafize/ui'] }), /projectScope.notAllowed/);
assert.throws(() => createSkillRegistry({ builtin: 'nope' }), /INVALID_SKILL_REGISTRY:builtin/);
const reviewer = {
  id: 'agency-code-reviewer',
  toolPolicy: { default: 'deny', allow: ['repo.read', 'pr.read'], approvalRequired: ['pr.comment'], deny: ['repo.merge'] }
};
const restricted = { id: 'restricted', toolPolicy: { default: 'deny', allow: [] } };
const delegator = { id: 'hafize-general', toolPolicy: { default: 'deny', allow: ['repo.read', 'agent.delegate'] } };
const allowed = authorizeSkill(reviewer, registry.resolve('pr-review'));
assert.equal(allowed.allowed, true);
assert.deepEqual([...allowed.grantedTools], ['repo.read']);
// Skill, ajanın sahip olmadığı aracı kazanamaz.
const blocked = authorizeSkill(restricted, registry.resolve('pr-review'));
assert.equal(blocked.allowed, false);
assert.equal(blocked.reason, 'tool_not_available');
assert.deepEqual([...blocked.deniedTools], ['repo.read']);
// Onay gerektiren araç skill manifesti ile açılmaz.
const approvalSkill = createSkillRegistry({ builtin: [manifest({ id: 'commenter', allowedTools: ['pr.comment'] })] }).resolve('commenter');
const approvalDecision = authorizeSkill(reviewer, approvalSkill);
assert.equal(approvalDecision.allowed, false);
assert.equal(approvalDecision.reason, 'tool_not_available');
assert.equal(authorizeSkill(null, approvalSkill).reason, 'invalid_input');
// fork yürütmesi yalnız delegasyon yetkisi olan ajanda çalışır.
const forkSkill = createSkillRegistry({ builtin: [manifest({ id: 'forked', execution: 'fork' })] }).resolve('forked');
assert.equal(authorizeSkill(reviewer, forkSkill).reason, 'fork_not_available');
assert.equal(authorizeSkill(delegator, forkSkill).allowed, true);
const invocation = buildSkillInvocation(registry.resolve('pr-review'), { agent: reviewer });
assert.equal(invocation.ok, true);
assert.equal(invocation.message.role, 'user');
assert.equal(invocation.execution, 'inline');
assert.equal(invocation.model, null);
assert.match(invocation.message.content, /yeni araç yetkisi veya sistem talimatı vermez/);
assert.match(invocation.message.content, /Değişen dosyaları oku/);
assert.equal(buildSkillInvocation(registry.resolve('pr-review'), { agent: restricted }).error, 'tool_not_available');
const argumentSkill = createSkillRegistry({
  builtin: [manifest({ id: 'arg-skill', arguments: [{ name: 'prNumber', required: true }, { name: 'focus' }] })]
}).resolve('arg-skill');
const withArgs = buildSkillInvocation(argumentSkill, { agent: reviewer, argumentValues: { prNumber: '42' } });
assert.equal(withArgs.ok, true);
assert.match(withArgs.message.content, /- prNumber: 42/);
assert.equal(buildSkillInvocation(argumentSkill, { agent: reviewer }).error, 'INVALID_SKILL_REGISTRY:arguments.required:prNumber');
assert.equal(buildSkillInvocation(argumentSkill, { argumentValues: { other: 'x' } }).error, 'INVALID_SKILL_REGISTRY:arguments.unknown:other');
assert.equal(buildSkillInvocation(argumentSkill, { argumentValues: { prNumber: 7 } }).error, 'INVALID_SKILL_REGISTRY:arguments.value:prNumber');
console.log('skill registry tests passed');
