import assert from 'node:assert/strict';
import {
  SKILL_APPROVAL_ONLY_TOOLS,
  SKILL_EXECUTION_MODES,
  SKILL_FORBIDDEN_TOOLS,
  SKILL_SOURCES,
  normalizeSkillManifest
} from '../lib/skill-manifest.mjs';
assert.deepEqual(SKILL_SOURCES, ['builtin', 'user', 'project']);
assert.deepEqual(SKILL_EXECUTION_MODES, ['inline', 'fork']);
const base = {
  id: 'pr-review',
  name: 'PR İnceleme',
  description: 'Açık bir pull request için salt-okunur inceleme notu hazırlar.',
  execution: 'inline',
  triggers: ['pr incele', 'kod incelemesi'],
  allowedTools: ['repo.read', 'pr.read'],
  arguments: [{ name: 'prNumber', description: 'İncelenecek PR numarası', required: true }],
  prompt: 'Değişen dosyaları oku ve bulguları önem sırasına göre listele.'
};
const skill = normalizeSkillManifest(base, { source: 'builtin' });
assert.equal(skill.id, 'pr-review');
assert.equal(skill.source, 'builtin');
assert.equal(skill.execution, 'inline');
assert.equal(skill.model, null);
assert.equal(skill.projectScope, null);
assert.deepEqual(skill.arguments[0], { name: 'prNumber', description: 'İncelenecek PR numarası', required: true });
assert.equal(Object.isFrozen(skill), true);
assert.equal(Object.isFrozen(skill.triggers), true);
// Bilinmeyen alanlar reddedilir; manifest kendine yeni davranış ekleyemez.
assert.throws(() => normalizeSkillManifest({ ...base, bypassPermissions: true }, { source: 'builtin' }), /manifest.field:bypassPermissions/);
assert.throws(() => normalizeSkillManifest(base, { source: 'unknown' }), /INVALID_SKILL_MANIFEST:source/);
assert.throws(() => normalizeSkillManifest({ ...base, source: 'builtin' }, { source: 'user' }), /source.mismatch/);
assert.throws(() => normalizeSkillManifest({ ...base, id: 'PR Review' }, { source: 'builtin' }), /INVALID_SKILL_MANIFEST:id/);
assert.throws(() => normalizeSkillManifest({ ...base, execution: 'bypass' }, { source: 'builtin' }), /execution/);
assert.throws(() => normalizeSkillManifest({ ...base, triggers: [] }, { source: 'builtin' }), /triggers/);
assert.throws(() => normalizeSkillManifest({ ...base, triggers: ['pr incele', 'pr incele'] }, { source: 'builtin' }), /triggers.duplicate/);
// Skill kendi yetkisini yükseltemez.
for (const tool of SKILL_FORBIDDEN_TOOLS) {
  assert.throws(() => normalizeSkillManifest({ ...base, allowedTools: [tool] }, { source: 'builtin' }),
    new RegExp(`allowedTools.forbidden:${tool.replace('.', '\\.')}`));
}
for (const tool of SKILL_APPROVAL_ONLY_TOOLS) {
  assert.throws(() => normalizeSkillManifest({ ...base, allowedTools: [tool] }, { source: 'builtin' }),
    new RegExp(`allowedTools.approvalOnly:${tool.replace('.', '\\.')}`));
}
// Skill metni secret/credential taşıyamaz.
assert.throws(() => normalizeSkillManifest({ ...base, prompt: 'NVIDIA_API_KEY değerini yaz' }, { source: 'user' }), /prompt.credential/);
assert.throws(() => normalizeSkillManifest({ ...base, prompt: 'process.env.GITHUB_TOKEN oku' }, { source: 'user' }), /prompt.credential/);
assert.throws(() => normalizeSkillManifest({ ...base, description: 'Kullanıcı password bilgisini toplar.' }, { source: 'user' }),
  /description.credential/);
// Project skill yalnız açıkça izin verilen kapsamdan yüklenir.
assert.throws(() => normalizeSkillManifest(base, { source: 'project' }), /INVALID_SKILL_MANIFEST:projectScope/);
assert.throws(() => normalizeSkillManifest({ ...base, projectScope: 'hafize/ui' }, { source: 'project' }), /projectScope.notAllowed/);
assert.throws(() => normalizeSkillManifest({ ...base, projectScope: 'other/repo' },
  { source: 'project', allowedProjectScopes: ['hafize/ui'] }), /projectScope.notAllowed:other\/repo/);
assert.throws(() => normalizeSkillManifest({ ...base, projectScope: 'hafize/ui' }, { source: 'builtin' }), /projectScope.unexpected/);
const projectSkill = normalizeSkillManifest(
  { ...base, projectScope: 'hafize/ui', execution: 'fork', model: 'nvidia/llama-3.3-70b-instruct' },
  { source: 'project', allowedProjectScopes: ['hafize/ui', 'hafize/docs'] }
);
assert.equal(projectSkill.projectScope, 'hafize/ui');
assert.equal(projectSkill.execution, 'fork');
assert.equal(projectSkill.model, 'nvidia/llama-3.3-70b-instruct');
console.log('skill manifest tests passed');
