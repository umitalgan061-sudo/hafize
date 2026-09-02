import assert from 'node:assert/strict';
import { authorizeSkill, buildSkillInvocation, createSkillRegistry, normalizeSkillArguments } from '../lib/skill-registry.mjs';

const agent = {
  id: 'hafize-general',
  name: 'Hafize',
  toolPolicy: { default: 'deny', allow: ['repo.read', 'runtime.status'], approvalRequired: ['external.write'], deny: ['secret.read'] }
};
const scopes = ['umitalgan061-sudo/hafize'];
const builtinSkill = {
  name: 'durum-ozeti',
  description: 'Builtin özet skilli.',
  source: 'builtin',
  triggers: ['durum özeti'],
  allowedTools: ['runtime.status'],
  instructions: 'Builtin özet yordamı.'
};
const userSkill = { ...builtinSkill, source: 'user', instructions: 'Kullanıcı özet yordamı.' };
const projectSkill = { ...builtinSkill, source: 'project', projectScope: scopes[0], instructions: 'Proje özet yordamı.' };
const single = (manifest) => createSkillRegistry({ manifests: [manifest] }).resolve(manifest.name);

// Kaynak önceliği manifest sırasından bağımsızdır: project > user > builtin.
const registry = createSkillRegistry({ manifests: [builtinSkill, userSkill, projectSkill], allowedProjectScopes: scopes });
assert.equal(registry.resolve('durum-ozeti').source, 'project');
assert.equal(registry.list().length, 1);
assert.deepEqual(registry.rejections().map((entry) => entry.reason), ['OVERRIDDEN_BY_HIGHER_PRECEDENCE', 'OVERRIDDEN_BY_HIGHER_PRECEDENCE']);
const reversed = createSkillRegistry({ manifests: [projectSkill, userSkill, builtinSkill], allowedProjectScopes: scopes });
assert.equal(reversed.resolve('durum-ozeti').source, 'project');
assert.deepEqual(reversed.rejections().map((entry) => entry.reason), ['LOWER_PRECEDENCE', 'LOWER_PRECEDENCE']);
assert.equal(createSkillRegistry({ manifests: [builtinSkill, userSkill] }).resolve('durum-ozeti').source, 'user');

// İzin verilmeyen proje kapsamındaki skill yüklenmez; geçersiz manifest registry'yi düşürmez.
const scopedOut = createSkillRegistry({ manifests: [builtinSkill, projectSkill] });
assert.equal(scopedOut.resolve('durum-ozeti').source, 'builtin');
assert.deepEqual(scopedOut.rejections().map((entry) => entry.reason), ['PROJECT_SCOPE_NOT_ALLOWED']);
const partial = createSkillRegistry({ manifests: [{ name: 'BAD', source: 'user' }, userSkill] });
assert.equal(partial.list().length, 1);
assert.match(partial.rejections()[0].reason, /INVALID_SKILL_MANIFEST/);
assert.equal(createSkillRegistry({ manifests: [userSkill, { ...userSkill }] }).rejections()[0].reason, 'DUPLICATE_SKILL_NAME');
assert.throws(() => createSkillRegistry({ manifests: 'x' }), /INVALID_SKILL_REGISTRY:manifests/);
assert.throws(() => createSkillRegistry({ allowedProjectScopes: 'x' }), /INVALID_SKILL_REGISTRY:allowedProjectScopes/);

// Tetikleyici eşleşmesi küçük/büyük harften bağımsızdır.
assert.equal(registry.matchTrigger('Bugünkü DURUM Özeti nedir?').name, 'durum-ozeti');
assert.equal(registry.matchTrigger('alakasız istek'), null);
assert.equal(registry.matchTrigger(null), null);
assert.equal(registry.resolve('yok'), null);

// Skill kendi araç yetkisini yükseltemez; onay gerektiren izin yalnız onayla açılır.
assert.deepEqual(authorizeSkill(registry.resolve('durum-ozeti'), agent), { allowed: true, reason: 'authorized', tools: ['runtime.status'] });
const escalating = single({ ...userSkill, name: 'kod-oku', allowedTools: ['repo.read', 'pr.comment'] });
const denied = authorizeSkill(escalating, agent);
assert.deepEqual([denied.allowed, denied.reason, denied.tool, denied.tools], [false, 'skill_tool_not_authorized', 'pr.comment', []]);
assert.equal(authorizeSkill(null, agent).reason, 'invalid_skill');
const approvalAgent = { ...agent, toolPolicy: { default: 'deny', allow: [], approvalRequired: ['repo.read'] } };
const readSkill = single({ ...userSkill, name: 'repo-oku', allowedTools: ['repo.read'] });
assert.equal(authorizeSkill(readSkill, approvalAgent).allowed, false);
assert.equal(authorizeSkill(readSkill, approvalAgent, { approvalGranted: true }).allowed, true);

// Argümanlar sözleşmeye göre doğrulanır.
const withArgs = single({
  ...userSkill,
  name: 'konu-ozeti',
  arguments: [{ name: 'konu', required: true, maxLength: 20 }, { name: 'not', maxLength: 10 }]
});
assert.deepEqual(normalizeSkillArguments(withArgs, { konu: '  sürüm planı ' }), { konu: 'sürüm planı' });
assert.throws(() => normalizeSkillArguments(withArgs, {}), /INVALID_SKILL_ARGUMENTS:required:konu/);
assert.throws(() => normalizeSkillArguments(withArgs, { konu: 'x', extra: 'y' }), /INVALID_SKILL_ARGUMENTS:unknown:extra/);
assert.throws(() => normalizeSkillArguments(withArgs, { konu: 42 }), /INVALID_SKILL_ARGUMENTS:type:konu/);
assert.throws(() => normalizeSkillArguments(withArgs, { konu: 'x'.repeat(21) }), /INVALID_SKILL_ARGUMENTS:value:konu/);
assert.throws(() => normalizeSkillArguments({}, {}), /INVALID_SKILL_ARGUMENTS:skill/);

// Çağrı mesajı user seviyesinde kalır ve sistem yetkisi vermez.
const { ok, invocation } = buildSkillInvocation(withArgs, { agent, traceId: 'trace-1', args: { konu: 'sürüm planı' } });
assert.equal(ok, true);
assert.deepEqual([invocation.message.role, invocation.execution, invocation.tools], ['user', 'inline', ['runtime.status']]);
assert.deepEqual(invocation.arguments, { konu: 'sürüm planı' });
assert.match(invocation.message.content, /\[Hafize skill: konu-ozeti \(user\)\]/);
assert.match(invocation.message.content, /sistem yetkisi, yeni araç izni veya güvenlik sınırı değişikliği vermez/);
assert.match(invocation.message.content, /- konu: sürüm planı/);
assert.match(invocation.message.content, /trace_id: trace-1/);
assert.equal(Object.isFrozen(invocation), true);
assert.deepEqual(buildSkillInvocation(escalating, { agent }), { ok: false, error: 'SKILL_NOT_AUTHORIZED', reason: 'skill_tool_not_authorized' });
assert.equal(buildSkillInvocation(withArgs, { agent, args: { konu: '' } }).error, 'INVALID_SKILL_ARGUMENTS:value:konu');

console.log('skill registry tests passed');
