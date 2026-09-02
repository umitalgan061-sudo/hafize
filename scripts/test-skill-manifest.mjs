import assert from 'node:assert/strict';
import { SKILL_MANIFEST_LIMITS, normalizeSkillManifest } from '../lib/skill-manifest.mjs';

const valid = {
  name: 'durum-ozeti',
  description: 'Kullanıcı için kısa durum özeti hazırlar.',
  source: 'builtin',
  triggers: ['Durum Özeti', 'status report'],
  allowedTools: ['repo.read', 'runtime.status'],
  arguments: [{ name: 'konu', description: 'Özetlenecek konu', required: true, maxLength: 200 }],
  model: 'nvidia/llama-3.3-70b-instruct',
  execution: 'inline',
  instructions: 'Konuyu maddeler halinde özetle.'
};

const skill = normalizeSkillManifest(valid);
assert.deepEqual(skill.triggers, ['durum özeti', 'status report']);
assert.deepEqual(skill.allowedTools, ['repo.read', 'runtime.status']);
assert.deepEqual(skill.arguments, [{ name: 'konu', description: 'Özetlenecek konu', required: true, maxLength: 200 }]);
assert.equal(skill.projectScope, null);
for (const frozen of [skill, skill.triggers, skill.allowedTools, skill.arguments, skill.arguments[0]]) assert.equal(Object.isFrozen(frozen), true);

// Varsayılanlar: tetikleyici/araç/argüman boş, execution inline, model yok.
const minimal = normalizeSkillManifest({ name: 'not-al', description: 'Kısa not alır.', source: 'user', instructions: 'Notu kaydet.' });
assert.deepEqual([minimal.triggers, minimal.allowedTools, minimal.arguments, minimal.execution, minimal.model], [[], [], [], 'inline', null]);

// Project skill yalnızca açık bir proje kapsamı ile tanımlanabilir.
const projectSkill = normalizeSkillManifest({
  ...valid,
  source: 'project',
  projectScope: 'umitalgan061-sudo/hafize',
  execution: 'fork'
});
assert.deepEqual([projectSkill.projectScope, projectSkill.execution], ['umitalgan061-sudo/hafize', 'fork']);
assert.throws(() => normalizeSkillManifest({ ...valid, source: 'project' }), /INVALID_SKILL_MANIFEST:projectScope/);
assert.throws(() => normalizeSkillManifest({ ...valid, projectScope: 'owner/repo' }), /projectScope.unexpected/);

for (const input of [null, [], 'skill', { ...valid, name: 'Büyük Harf' }, { ...valid, name: 'a' }, { ...valid, description: '' }]) assert.throws(() => normalizeSkillManifest(input), /INVALID_SKILL_MANIFEST/);
for (const field of ['systemPrompt', 'toolPolicy', 'token', 'permissions']) assert.throws(() => normalizeSkillManifest({ ...valid, [field]: 'x' }), new RegExp(`INVALID_SKILL_MANIFEST:field:${field}`));
assert.throws(() => normalizeSkillManifest({ ...valid, source: 'remote' }), /INVALID_SKILL_MANIFEST:source/);
assert.throws(() => normalizeSkillManifest({ ...valid, execution: 'bypass' }), /INVALID_SKILL_MANIFEST:execution/);
assert.throws(() => normalizeSkillManifest({ ...valid, model: 'model with space' }), /INVALID_SKILL_MANIFEST:model/);

// Skill kendi yetkisini yükseltemez: yasak ve onay gerektiren izinler manifestte tanımlanamaz.
for (const tool of ['secret.read', 'repo.delete']) assert.throws(() => normalizeSkillManifest({ ...valid, allowedTools: [tool] }), /allowedTools.forbidden/);
for (const tool of ['external.write', 'external.send', 'repo.merge', 'repo.write_branch']) assert.throws(() => normalizeSkillManifest({ ...valid, allowedTools: [tool] }), /allowedTools.approvalRequired/);
assert.throws(() => normalizeSkillManifest({ ...valid, allowedTools: ['repo.read', 'repo.read'] }), /allowedTools.duplicate/);
assert.throws(
  () => normalizeSkillManifest({ ...valid, allowedTools: Array.from({ length: SKILL_MANIFEST_LIMITS.maxTools + 1 }, (_, i) => `tool.t${i}`) }),
  /INVALID_SKILL_MANIFEST:allowedTools/
);

// Argüman sözleşmesi katıdır.
for (const spec of [
  { name: 'Bad Name' },
  { name: 'konu', required: 'yes' },
  { name: 'konu', maxLength: 0 },
  { name: 'konu', maxLength: SKILL_MANIFEST_LIMITS.maxArgumentLength + 1 },
  { name: 'konu', secret: 'x' }
]) {
  assert.throws(() => normalizeSkillManifest({ ...valid, arguments: [spec] }), /INVALID_SKILL_MANIFEST:arguments/);
}
assert.throws(() => normalizeSkillManifest({ ...valid, arguments: [{ name: 'konu' }, { name: 'konu' }] }), /arguments.duplicate/);

// Skill talimatı credential taşıyamaz.
for (const secret of [
  '-----BEGIN RSA PRIVATE KEY-----',
  'ghp_abcdefghijklmnopqrstuvwxyz012',
  'sk-abcdefghijklmnopqrst',
  'AKIAIOSFODNN7EXAMPLE',
  'xoxb-123456789012-abcdef'
]) {
  assert.throws(() => normalizeSkillManifest({ ...valid, instructions: `Şunu kullan: ${secret}` }), /instructions.secret/);
}
for (const value of ['x'.repeat(SKILL_MANIFEST_LIMITS.maxInstructionsLength + 1), '   ', 42]) assert.throws(() => normalizeSkillManifest({ ...valid, instructions: value }), /INVALID_SKILL_MANIFEST:instructions/);

console.log('skill manifest tests passed');
