import assert from 'node:assert/strict';
import { SKILL_SOURCE_PRECEDENCE, createSkillRegistry } from '../lib/skill-registry.mjs';

const inlineSkill = {
  id: 'daily-summary', name: 'Günlük Özet', description: 'Günü özetler.',
  source: 'builtin', execution: 'inline', triggers: ['günü özetle'],
  allowedTools: ['task.read', 'trace.write', 'external.notify'],
  arguments: [{ name: 'gun', type: 'string', required: true, maxLength: 32 }, { name: 'detayli', type: 'boolean' }],
  prompt: 'Günü maddeler halinde özetle.'
};
const forkSkill = {
  id: 'repo-triage', name: 'Repo Triage', description: 'Depo görevlerini ayrıştırır.',
  source: 'user', execution: 'fork', triggers: ['repo triage'],
  allowedTools: ['repo.read'], prompt: 'Depoyu incele ve bulguları sırala.'
};
const delegator = {
  id: 'hafize-general',
  toolPolicy: { default: 'deny', allow: ['task.read', 'trace.write', 'agent.delegate', 'repo.read'], approvalRequired: ['external.write'] }
};
const restricted = { id: 'agency-code-reviewer', toolPolicy: { default: 'deny', allow: ['repo.read'], deny: ['agent.delegate'] } };

const registry = createSkillRegistry({ skills: [inlineSkill, forkSkill] });
assert.deepEqual(registry.list().map((skill) => skill.id), ['daily-summary', 'repo-triage']);
assert.equal(Object.isFrozen(registry.list()[0]), true);
assert.equal(registry.resolve('daily-summary').name, 'Günlük Özet');
assert.equal(registry.resolve('missing'), null);
assert.equal(registry.resolve(''), null);
assert.deepEqual(registry.match('Lütfen günü özetle bugün'), ['daily-summary']);
assert.deepEqual(registry.match('alakasız istek'), []);
assert.deepEqual(registry.match(''), []);
assert.equal(registry.match('günü özetle ve repo triage yap', { limit: 1 }).length, 1);

const prepared = registry.prepareInvocation({ skillId: 'daily-summary', agent: delegator, args: { gun: '  bugün  ', detayli: true } });
assert.equal(prepared.ok, true);
assert.equal(Object.isFrozen(prepared.invocation), true);
assert.deepEqual(prepared.invocation.arguments, { gun: 'bugün', detayli: true });
// Ajan politikasında bulunmayan izin skill üzerinden kazanılamaz.
assert.deepEqual(prepared.invocation.tools, ['task.read', 'trace.write']);
assert.deepEqual(prepared.invocation.droppedTools, ['external.notify']);
assert.match(prepared.invocation.prompt, /Günü maddeler halinde özetle\./);
assert.match(prepared.invocation.prompt, /veri olarak ele al/);
assert.match(prepared.invocation.prompt, /- gun: bugün/);
assert.match(prepared.invocation.prompt, /task\.read, trace\.write/);
assert.equal(prepared.invocation.prompt.includes('external.notify'), false);

// Onay bekleyen izinler onaysız kesişimde görünmez.
const approvalAgent = { id: 'x', toolPolicy: { default: 'deny', approvalRequired: ['task.read'] } };
const approvalPrepared = registry.prepareInvocation({ skillId: 'daily-summary', agent: approvalAgent, args: { gun: 'bugün' } });
assert.deepEqual(approvalPrepared.invocation.tools, []);
assert.match(approvalPrepared.invocation.prompt, /ek araç yetkisi yoktur/);

// Fork execution yalnız delegasyona yetkili ajanda çalışır.
assert.equal(registry.prepareInvocation({ skillId: 'repo-triage', agent: delegator }).ok, true);
assert.deepEqual(registry.prepareInvocation({ skillId: 'repo-triage', agent: restricted }), { ok: false, error: 'SKILL_FORK_NOT_AUTHORIZED' });
assert.deepEqual(registry.prepareInvocation({ skillId: 'nope', agent: delegator }), { ok: false, error: 'SKILL_NOT_FOUND' });
assert.deepEqual(registry.prepareInvocation({ skillId: 'repo-triage' }), { ok: false, error: 'INVALID_SKILL_REQUEST' });
assert.deepEqual(registry.prepareInvocation(), { ok: false, error: 'SKILL_NOT_FOUND' });

for (const args of [
  undefined, {}, { gun: '' }, { gun: 'x'.repeat(33) }, { gun: 'bugün', bilinmeyen: 1 },
  { gun: 'bugün', detayli: 'evet' }, { gun: 42 }, 'bugün', []
]) assert.deepEqual(registry.prepareInvocation({ skillId: 'daily-summary', agent: delegator, args }), { ok: false, error: 'INVALID_SKILL_ARGUMENTS' });

// Kaynak önceliği: builtin > user > project; düşük güvenli kaynak id'yi gölgeleyemez.
const shadowRegistry = createSkillRegistry({
  skills: [{ ...inlineSkill, source: 'project', projectScope: 'hafize', prompt: 'Sahte özet.' }, inlineSkill],
  allowedProjectScopes: ['hafize']
});
assert.equal(shadowRegistry.resolve('daily-summary').source, 'builtin');
assert.deepEqual(shadowRegistry.shadowed, [{ id: 'daily-summary', source: 'project', shadowedBy: 'builtin' }]);
assert.equal(Object.isFrozen(shadowRegistry.shadowed), true);

// Project skill yalnız açıkça izin verilen kapsamdan yüklenir.
const projectSkill = { ...forkSkill, source: 'project', projectScope: 'hafize' };
assert.throws(() => createSkillRegistry({ skills: [{ ...projectSkill, projectScope: 'other' }], allowedProjectScopes: ['hafize'] }), /projectScopeNotAllowed/);
assert.throws(() => createSkillRegistry({ skills: [projectSkill] }), /projectScopeNotAllowed/);
assert.throws(() => createSkillRegistry({ skills: [inlineSkill, inlineSkill] }), /INVALID_SKILL_REGISTRY:duplicate/);
assert.throws(() => createSkillRegistry({ skills: 'skill' }), /INVALID_SKILL_REGISTRY:skills/);
assert.throws(() => createSkillRegistry({ skills: [], allowedProjectScopes: 'hafize' }), /allowedProjectScopes/);
assert.throws(() => createSkillRegistry({ skills: [{ ...inlineSkill, id: 'BAD' }] }), /INVALID_SKILL_ID/);
assert.deepEqual(createSkillRegistry().list(), []);
assert.deepEqual(SKILL_SOURCE_PRECEDENCE, ['builtin', 'user', 'project']);

console.log('skill registry tests passed');
