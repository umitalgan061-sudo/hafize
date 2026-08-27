import assert from 'node:assert/strict';
import {
  SKILL_MANIFEST_LIMITS,
  SKILL_MANIFEST_SOURCES,
  normalizeSkillManifest
} from '../lib/skill-manifest-contract.mjs';

const validInput = {
  name: 'Repo-Ozet',
  description: 'Bir GitHub deposunun yapısını özetler.',
  triggers: ['repo özeti', 'depo yapısı'],
  allowedTools: ['repo.read', 'runtime.status'],
  arguments: [{ name: 'repository', description: 'owner/repo biçiminde depo.', required: true }],
  model: 'nvidia/llama-3.3-70b-instruct',
  execution: 'fork',
  prompt: 'Depoyu salt-okunur araçlarla incele ve kısa bir yapı özeti üret.'
};
const rejects = (overrides, pattern, options = { source: 'user' }) =>
  assert.throws(() => normalizeSkillManifest({ ...validInput, ...overrides }, options), pattern);

const skill = normalizeSkillManifest(validInput, { source: 'user' });
assert.equal(skill.name, 'repo-ozet');
assert.equal(skill.source, 'user');
assert.equal(skill.execution, 'fork');
assert.deepEqual(skill.allowedTools, ['repo.read', 'runtime.status']);
assert.deepEqual(skill.arguments, [{ name: 'repository', description: 'owner/repo biçiminde depo.', required: true }]);
for (const frozen of [skill, skill.allowedTools, skill.triggers, skill.arguments, skill.arguments[0]]) {
  assert.equal(Object.isFrozen(frozen), true);
}

const minimal = normalizeSkillManifest(
  { name: 'not-al', description: 'Kısa not alır.', prompt: 'Kullanıcı notunu düzenle.' },
  { source: 'builtin' }
);
assert.equal(minimal.execution, 'inline');
assert.equal(minimal.model, null);
assert.deepEqual([minimal.triggers, minimal.allowedTools, minimal.arguments], [[], [], []]);

// Kaynak yükleyiciden gelir; manifest kendi kaynağını veya yetkisini ilan edemez.
assert.deepEqual(SKILL_MANIFEST_SOURCES, ['builtin', 'user', 'project']);
for (const source of [undefined, null, '', 'system', 'admin', 'BUILTIN']) rejects({}, /INVALID_SKILL_SOURCE/, { source });
for (const field of ['source', 'systemPrompt', 'toolPolicy', 'approvalGranted', 'env', 'credentials']) {
  rejects({ [field]: 'x' }, /INVALID_SKILL_FIELD/);
}
for (const input of [null, [], 'skill', {}]) {
  assert.throws(() => normalizeSkillManifest(input, { source: 'user' }), /INVALID_SKILL/);
}

for (const name of ['', 'a', '1skill', 'Skill Name', 'skill_name', 'x'.repeat(65)]) rejects({ name }, /INVALID_SKILL_NAME/);
for (const description of ['', '\0', 'x'.repeat(SKILL_MANIFEST_LIMITS.maxDescriptionLength + 1)]) {
  rejects({ description }, /INVALID_SKILL_DESCRIPTION/);
}
for (const prompt of ['', '\0', 'x'.repeat(SKILL_MANIFEST_LIMITS.maxPromptLength + 1)]) {
  rejects({ prompt }, /INVALID_SKILL_PROMPT/);
}

// Skill prompt'u veya açıklaması credential taşıyamaz.
for (const secret of [
  'Anahtarı process.env.NVIDIA_API_KEY üzerinden oku.',
  'Token: ${GITHUB_TOKEN} kullan.',
  'client_secret = abc123 ile bağlan.',
  '-----BEGIN RSA PRIVATE KEY-----'
]) {
  rejects({ prompt: secret }, /SKILL_SECRET_MATERIAL/);
  rejects({ description: secret }, /SKILL_SECRET_MATERIAL/);
  rejects({ arguments: [{ name: 'gizli', description: secret }] }, /SKILL_SECRET_MATERIAL/);
}

// Hiç verilmeyen ve yalnız onayla açılan izinler manifestte tanımlanamaz.
for (const permission of ['secret.read', 'repo.delete']) {
  rejects({ allowedTools: [permission] }, /SKILL_FORBIDDEN_PERMISSION/);
}
for (const permission of ['external.write', 'external.send', 'repo.merge', 'repo.write_branch']) {
  rejects({ allowedTools: [permission] }, /SKILL_APPROVAL_PERMISSION_NOT_DECLARABLE/);
}
for (const allowedTools of [
  'repo.read',
  ['repo.read', 'repo.read'],
  ['Repo.Read'],
  [''],
  Array.from({ length: SKILL_MANIFEST_LIMITS.maxAllowedTools + 1 }, (_, index) => `tool.${index}`)
]) {
  rejects({ allowedTools }, /INVALID_SKILL_ALLOWED_TOOL/);
}

for (const execution of ['bypass', 'sudo', 'INLINE', '']) rejects({ execution }, /INVALID_SKILL_EXECUTION/);
for (const args of [
  'repository',
  [{ name: 'repository', description: 'x', extra: true }],
  [{ name: 'Repo', description: 'x' }],
  [{ name: 'repository', description: 'x' }, { name: 'repository', description: 'y' }],
  [{ name: 'repository' }],
  [{ name: 'repository', description: 'x', required: 'yes' }]
]) {
  rejects({ arguments: args }, /INVALID_SKILL_ARGUMENT/);
}

rejects({ model: 'nvidia model' }, /INVALID_SKILL_MODEL/);
rejects({ triggers: ['repo ozeti', 'Repo Ozeti'] }, /INVALID_SKILL_TRIGGER/);

console.log('skill manifest contract tests passed');
