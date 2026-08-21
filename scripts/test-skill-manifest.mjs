import assert from 'node:assert/strict';
import { SKILL_MANIFEST_LIMITS, normalizeSkillManifest } from '../lib/skill-manifest.mjs';

const validManifest = {
  name: 'rapor-ozeti',
  description: 'Uzun raporu kısa ve doğrulanabilir bir özete indirger.',
  prompt: 'Raporu oku, önce bulguları sonra riskleri listele.',
  execution: 'inline',
  triggers: ['Rapor Özeti', 'özet çıkar'],
  allowedTools: ['repo.read', 'trace.write'],
  arguments: [{ name: 'kapsam', description: 'Özetlenecek bölüm.', required: true }, { name: 'dil' }]
};

const skill = normalizeSkillManifest(validManifest, { source: 'user' });
assert.equal(skill.name, 'rapor-ozeti');
assert.equal(skill.source, 'user');
assert.equal(skill.execution, 'inline');
assert.equal(skill.model, null);
assert.equal(skill.projectScope, null);
assert.deepEqual(skill.triggers, ['rapor özeti', 'özet çıkar']);
assert.deepEqual(skill.allowedTools, ['repo.read', 'trace.write']);
assert.deepEqual(skill.arguments, [
  { name: 'kapsam', description: 'Özetlenecek bölüm.', required: true },
  { name: 'dil', description: null, required: false }
]);
assert.equal(Object.isFrozen(skill), true);
assert.equal(Object.isFrozen(skill.triggers), true);
assert.equal(Object.isFrozen(skill.allowedTools), true);
assert.equal(Object.isFrozen(skill.arguments[0]), true);

// Kaynak zorunlu ve sabit kümedir; manifest kendi kaynağını seçemez.
for (const source of [undefined, null, 'system', 'plugin', '']) {
  assert.throws(() => normalizeSkillManifest(validManifest, { source }), /INVALID_SKILL_SOURCE/);
}
assert.throws(
  () => normalizeSkillManifest({ ...validManifest, source: 'builtin' }, { source: 'user' }),
  /INVALID_SKILL_FIELD/
);

// Model tarafından doldurulabilecek yetki/kimlik alanları reddedilir.
for (const field of ['toolPolicy', 'approvalGranted', 'owner', 'apiKey', 'systemPrompt', 'agentId']) {
  assert.throws(
    () => normalizeSkillManifest({ ...validManifest, [field]: 'x' }, { source: 'user' }),
    /INVALID_SKILL_FIELD/
  );
}

for (const name of ['', 'A', 'x', 'Rapor', 'rapor_ozeti', 'rapor özeti', 'r'.repeat(49)]) {
  assert.throws(() => normalizeSkillManifest({ ...validManifest, name }, { source: 'user' }), /INVALID_SKILL_NAME/);
}

for (const execution of [undefined, 'bypass', 'INLINE', 'shell', '']) {
  assert.throws(
    () => normalizeSkillManifest({ ...validManifest, execution }, { source: 'user' }),
    /INVALID_SKILL_EXECUTION/
  );
}
assert.equal(normalizeSkillManifest({ ...validManifest, execution: 'fork' }, { source: 'user' }).execution, 'fork');

for (const description of ['', '  ', 'x'.repeat(SKILL_MANIFEST_LIMITS.maxDescriptionLength + 1), 'a\0b']) {
  assert.throws(
    () => normalizeSkillManifest({ ...validManifest, description }, { source: 'user' }),
    /INVALID_SKILL_DESCRIPTION/
  );
}

for (const prompt of ['', 42, 'x'.repeat(SKILL_MANIFEST_LIMITS.maxPromptLength + 1), 'a\0b']) {
  assert.throws(() => normalizeSkillManifest({ ...validManifest, prompt }, { source: 'user' }), /INVALID_SKILL_PROMPT/);
}

// Skill metni credential taşıyamaz.
for (const prompt of [
  'Şu anahtarı kullan: api_key=abc123',
  'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9',
  'password : hunter2',
  '-----BEGIN RSA PRIVATE KEY-----'
]) {
  assert.throws(() => normalizeSkillManifest({ ...validManifest, prompt }, { source: 'user' }), /SKILL_SECRET_REJECTED/);
}
assert.throws(
  () => normalizeSkillManifest({ ...validManifest, description: 'token=abc123 kullan' }, { source: 'user' }),
  /SKILL_SECRET_REJECTED/
);
// Yetkisiz eşleşme olmadan "token" kelimesi geçerlidir.
assert.ok(normalizeSkillManifest({ ...validManifest, prompt: 'Token sayısını azalt.' }, { source: 'user' }));

// Skill kendi araç yetkisini yükseltemez.
for (const permission of ['secret.read', 'repo.delete', 'external.write', 'external.send', 'repo.merge', 'repo.write_branch']) {
  assert.throws(
    () => normalizeSkillManifest({ ...validManifest, allowedTools: [permission] }, { source: 'user' }),
    /SKILL_TOOL_ESCALATION_REJECTED/
  );
}
for (const allowedTools of [['repo.read', 'repo.read'], ['Repo.Read'], ['']]) {
  assert.throws(
    () => normalizeSkillManifest({ ...validManifest, allowedTools }, { source: 'user' }),
    /INVALID_SKILL_ALLOWED_TOOL/
  );
}
assert.throws(
  () => normalizeSkillManifest(
    { ...validManifest, allowedTools: Array.from({ length: SKILL_MANIFEST_LIMITS.maxAllowedTools + 1 }, (_, i) => `t${i}.read`) },
    { source: 'user' }
  ),
  /INVALID_SKILL_ALLOWED_TOOLS/
);
assert.deepEqual(normalizeSkillManifest({ ...validManifest, allowedTools: null }, { source: 'user' }).allowedTools, []);

for (const triggers of [['x'], ['ayni', 'AYNI'], 'metin', Array.from({ length: SKILL_MANIFEST_LIMITS.maxTriggers + 1 }, (_, i) => `t${i}`)]) {
  assert.throws(() => normalizeSkillManifest({ ...validManifest, triggers }, { source: 'user' }), /INVALID_SKILL_TRIGGER/);
}

for (const args of [[{ name: 'Kapsam' }], [{ name: 'a' }, { name: 'a' }], [{ name: 'a', required: 'yes' }]]) {
  assert.throws(() => normalizeSkillManifest({ ...validManifest, arguments: args }, { source: 'user' }), /INVALID_SKILL_ARGUMENT/);
}
assert.throws(
  () => normalizeSkillManifest({ ...validManifest, arguments: [{ name: 'a', type: 'string' }] }, { source: 'user' }),
  /INVALID_SKILL_ARGUMENT_FIELD/
);

for (const model of ['', 'Model/Big', 'x'.repeat(81), 5]) {
  assert.throws(() => normalizeSkillManifest({ ...validManifest, model }, { source: 'user' }), /INVALID_SKILL_MODEL/);
}
assert.equal(
  normalizeSkillManifest({ ...validManifest, model: 'nvidia/llama-3.3-70b' }, { source: 'user' }).model,
  'nvidia/llama-3.3-70b'
);

// Project skill yalnız açık kapsamla tanımlanır; diğer kaynaklar kapsam veremez.
assert.throws(() => normalizeSkillManifest(validManifest, { source: 'project' }), /INVALID_SKILL_PROJECT_SCOPE/);
assert.throws(
  () => normalizeSkillManifest({ ...validManifest, projectScope: 'hafize' }, { source: 'user' }),
  /INVALID_SKILL_PROJECT_SCOPE/
);
assert.equal(
  normalizeSkillManifest({ ...validManifest, projectScope: 'umitalgan061-sudo/hafize' }, { source: 'project' }).projectScope,
  'umitalgan061-sudo/hafize'
);

console.log('skill manifest tests passed');
