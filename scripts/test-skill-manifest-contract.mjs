import assert from 'node:assert/strict';
import {
  SKILL_MANIFEST_LIMITS,
  normalizeSkillManifest,
  resolveSkillTools
} from '../lib/skill-manifest-contract.mjs';

const validInput = {
  id: 'daily-brief',
  name: 'Günlük Özet',
  description: 'Kullanıcının gününü kısa ve okunabilir bir özet olarak hazırlar.',
  triggers: ['günlük özet', 'Günün Planı'],
  allowedTools: ['task.read', 'connector.gmail.read'],
  arguments: [{ name: 'gun', description: 'Özetlenecek gün.', required: true }],
  model: 'meta/llama-3.1-70b-instruct',
  execution: 'inline',
  prompt: 'Kullanıcının gününü özetle ve açık maddeleri listele.'
};

const manifest = normalizeSkillManifest(validInput, { source: 'builtin' });
assert.deepEqual(manifest, {
  id: 'daily-brief',
  source: 'builtin',
  name: 'Günlük Özet',
  description: 'Kullanıcının gününü kısa ve okunabilir bir özet olarak hazırlar.',
  triggers: ['günlük özet', 'günün planı'],
  allowedTools: ['task.read', 'connector.gmail.read'],
  arguments: [{ name: 'gun', description: 'Özetlenecek gün.', required: true }],
  model: 'meta/llama-3.1-70b-instruct',
  execution: 'inline',
  prompt: 'Kullanıcının gününü özetle ve açık maddeleri listele.'
});
assert.equal(Object.isFrozen(manifest), true);
assert.equal(Object.isFrozen(manifest.triggers), true);
assert.equal(Object.isFrozen(manifest.allowedTools), true);
assert.equal(Object.isFrozen(manifest.arguments[0]), true);

// Varsayılanlar: opsiyonel alanlar boş ve execution inline.
const minimal = normalizeSkillManifest(
  { id: 'kisa', name: 'Kısa', description: 'Kısa yanıt üretir.', prompt: 'Kısa yanıt ver.' },
  { source: 'user' }
);
assert.deepEqual(minimal.triggers, []);
assert.deepEqual(minimal.allowedTools, []);
assert.deepEqual(minimal.arguments, []);
assert.equal(minimal.model, null);
assert.equal(minimal.execution, 'inline');
assert.equal(minimal.source, 'user');

// Strict manifest: bilinmeyen alan reddedilir.
for (const field of ['tools', 'permissions', 'systemPrompt', 'env', 'apiKey', 'source', 'path']) {
  assert.throws(
    () => normalizeSkillManifest({ ...validInput, [field]: 'x' }, { source: 'builtin' }),
    /INVALID_SKILL_MANIFEST_FIELD/
  );
}

// Kaynak zorunlu ve sabit listeden gelir; manifest kendi kaynağını seçemez.
for (const source of [undefined, null, 'system', 'remote', 'BUILTIN']) {
  assert.throws(() => normalizeSkillManifest(validInput, { source }), /INVALID_SKILL_SOURCE/);
}

// Proje kaynağı yalnız açıkça izin verilen kapsamdan yüklenir.
assert.throws(
  () => normalizeSkillManifest({ ...validInput, execution: 'inline' }, { source: 'project' }),
  /SKILL_PROJECT_SCOPE_NOT_ALLOWED/
);
const projectSkill = normalizeSkillManifest(
  { ...validInput, execution: 'inline' },
  { source: 'project', projectScopeAllowed: true }
);
assert.equal(projectSkill.source, 'project');

// fork yürütmesi proje kaynağına kapalı, builtin/user için açık.
assert.throws(
  () => normalizeSkillManifest({ ...validInput, execution: 'fork' }, { source: 'project', projectScopeAllowed: true }),
  /SKILL_FORK_EXECUTION_NOT_ALLOWED/
);
assert.equal(normalizeSkillManifest({ ...validInput, execution: 'fork' }, { source: 'user' }).execution, 'fork');
assert.throws(
  () => normalizeSkillManifest({ ...validInput, execution: 'worktree' }, { source: 'builtin' }),
  /INVALID_SKILL_EXECUTION/
);

// Kimlik, ad ve açıklama doğrulaması.
for (const id of ['', 'A', 'x', 'has space', 'Upper', '1abc', 'ok\nfine', 'a'.repeat(65)]) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, id }, { source: 'builtin' }), /INVALID_SKILL_ID/);
}
assert.throws(() => normalizeSkillManifest({ ...validInput, name: '  ' }, { source: 'builtin' }), /INVALID_SKILL_NAME/);
assert.throws(
  () => normalizeSkillManifest({ ...validInput, description: 'çok uzun'.repeat(200) }, { source: 'builtin' }),
  /INVALID_SKILL_DESCRIPTION/
);

// Tetikleyiciler normalize edilir, tekrar ve sınır aşımı reddedilir.
for (const triggers of [
  'metin',
  ['ozet', 'OZET'],
  ['a'.repeat(121)],
  ['iki\nsatır'],
  Array.from({ length: SKILL_MANIFEST_LIMITS.maxTriggers + 1 }, (_, index) => `t${index}`)
]) {
  assert.throws(
    () => normalizeSkillManifest({ ...validInput, triggers }, { source: 'builtin' }),
    /INVALID_SKILL_TRIGGER/
  );
}

// Skill kendi tool yetkisini yükseltemez.
for (const permission of SKILL_MANIFEST_LIMITS.neverSkillPermissions) {
  assert.throws(
    () => normalizeSkillManifest({ ...validInput, allowedTools: [permission] }, { source: 'builtin' }),
    /SKILL_TOOL_ESCALATION_NOT_ALLOWED/
  );
}
for (const allowedTools of [
  'task.read',
  ['task read'],
  ['task.read', 'task.read'],
  Array.from({ length: SKILL_MANIFEST_LIMITS.maxAllowedTools + 1 }, (_, index) => `tool.t${index}`)
]) {
  assert.throws(
    () => normalizeSkillManifest({ ...validInput, allowedTools }, { source: 'builtin' }),
    /INVALID_SKILL_ALLOWED_TOOL/
  );
}

// Argüman sözleşmesi.
for (const args of [
  [{ name: 'gun' }],
  [{ name: 'Gun', description: 'x' }],
  [{ name: 'gun', description: 'x' }, { name: 'gun', description: 'y' }],
  [{ name: 'gun', description: 'x', required: 'evet' }],
  [{ name: 'gun', description: 'x', extra: 1 }],
  ['gun']
]) {
  assert.throws(
    () => normalizeSkillManifest({ ...validInput, arguments: args }, { source: 'builtin' }),
    /INVALID_SKILL_ARGUMENT/
  );
}

// Prompt secret veya credential taşıyamaz.
for (const prompt of [
  'Anahtar: process.env.NVIDIA_API_KEY kullan.',
  'Token ${GITHUB_TOKEN} ile çağır.',
  'CANVA_CLIENT_SECRET= abc123 değerini kullan.',
  'Authorization: Bearer ya29.abcdefghijklmnop',
  'sk-abcdefghijklmnopqrstuvwx anahtarını kullan.',
  '-----BEGIN RSA PRIVATE KEY-----'
]) {
  assert.throws(
    () => normalizeSkillManifest({ ...validInput, prompt }, { source: 'builtin' }),
    /SKILL_PROMPT_SECRET_NOT_ALLOWED/
  );
}
for (const prompt of ['', '   ', 42, null, 'a'.repeat(SKILL_MANIFEST_LIMITS.maxPromptLength + 1)]) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, prompt }, { source: 'builtin' }), /INVALID_SKILL_PROMPT/);
}

// Model tercihi opsiyonel ama serbest metin değil.
assert.throws(() => normalizeSkillManifest({ ...validInput, model: 'model adı' }, { source: 'builtin' }), /INVALID_SKILL_MODEL/);

// Araç çözümü: ajanın sahip olmadığı yetki skill üzerinden kazanılamaz.
const resolved = resolveSkillTools(manifest, ['task.read', 'trace.write']);
assert.deepEqual(resolved.granted, ['task.read']);
assert.deepEqual(resolved.rejected, ['connector.gmail.read']);
assert.equal(Object.isFrozen(resolved), true);
assert.deepEqual(resolveSkillTools(manifest, []).granted, []);
assert.deepEqual(resolveSkillTools(minimal, ['task.read']).granted, []);
assert.throws(() => resolveSkillTools(null, []), /INVALID_SKILL_MANIFEST/);

console.log('skill manifest contract tests passed');
