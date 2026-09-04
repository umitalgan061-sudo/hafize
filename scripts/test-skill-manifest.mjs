import assert from 'node:assert/strict';
import { normalizeSkillManifest, SKILL_MANIFEST_LIMITS } from '../lib/skill-manifest.mjs';

const base = {
  id: 'rapor-ozeti',
  name: 'Rapor Özeti',
  description: 'Uzun raporları kısa ve doğrulanabilir özete indirger.',
  source: 'builtin',
  triggers: ['rapor', 'özet'],
  allowedTools: ['runtime.status', 'repo.read'],
  arguments: [{ name: 'baslik', description: 'Rapor başlığı', required: true, maxLength: 120 }],
  prompt: 'Raporu maddeler halinde özetle ve kanıt satırlarını koru.'
};

const skill = normalizeSkillManifest(base);
assert.equal(skill.id, 'rapor-ozeti');
assert.equal(skill.source, 'builtin');
assert.equal(skill.execution, 'inline');
assert.equal(skill.model, null);
assert.equal(skill.projectScope, null);
assert.deepEqual([...skill.allowedTools], ['runtime.status', 'repo.read']);
assert.deepEqual([...skill.arguments], [
  { name: 'baslik', description: 'Rapor başlığı', required: true, maxLength: 120 }
]);
assert.equal(Object.isFrozen(skill), true);
assert.equal(Object.isFrozen(skill.allowedTools), true);

// Varsayılanlar: opsiyonel alanlar güvenli tarafta kalır.
const minimal = normalizeSkillManifest({
  id: 'kod-gozden-gecir',
  name: 'Kod Gözden Geçir',
  description: 'Diff üzerinde küçük ve doğrulanabilir bulgular üretir.',
  source: 'user',
  prompt: 'Diff üzerinde yalnız gerçek hataları raporla.'
});
assert.deepEqual([...minimal.triggers], []);
assert.deepEqual([...minimal.allowedTools], []);
assert.deepEqual([...minimal.arguments], []);
assert.equal(minimal.execution, 'inline');

// Project skill kapsam alanı zorunludur ve dizin kaçışına izin verilmez.
const projectSkill = normalizeSkillManifest({ ...base, id: 'proje-notu', source: 'project', projectScope: 'apps/hafize' });
assert.equal(projectSkill.projectScope, 'apps/hafize');

const invalid = [
  ['manifest', null],
  ['manifest.extra', { ...base, extra: true }],
  ['id', { ...base, id: 'Rapor Özeti' }],
  ['source', { ...base, source: 'remote' }],
  ['execution', { ...base, execution: 'bypass' }],
  ['projectScope', { ...base, source: 'project', projectScope: '../../etc' }],
  ['projectScope', { ...base, source: 'project' }],
  ['projectScope.unexpected', { ...base, projectScope: 'apps/hafize' }],
  ['model', { ...base, model: 'model with space' }],
  ['triggers.duplicate', { ...base, triggers: ['rapor', 'RAPOR'] }],
  ['allowedTools', { ...base, allowedTools: ['NOT VALID'] }],
  ['allowedTools.forbidden:secret.read', { ...base, allowedTools: ['secret.read'] }],
  ['allowedTools.forbidden:repo.delete', { ...base, allowedTools: ['repo.delete'] }],
  ['arguments.name', { ...base, arguments: [{ name: '9bad' }] }],
  ['arguments.duplicate', { ...base, arguments: [{ name: 'a' }, { name: 'a' }] }],
  ['arguments.entry.unknown', { ...base, arguments: [{ name: 'a', unknown: 1 }] }],
  ['prompt', { ...base, prompt: 'kısa' }],
  ['prompt.secret', { ...base, prompt: 'Anahtarı kullan: NVIDIA_API_KEY = nvapi-0123456789abcdef' }],
  ['prompt.secret', { ...base, prompt: 'Şu başlığı ekle: Authorization: Bearer abcdefghijkl1234' }],
  ['prompt.secret', { ...base, prompt: 'Şunu kullan -----BEGIN RSA PRIVATE KEY----- devam et' }]
];

for (const [reason, manifest] of invalid) {
  assert.throws(
    () => normalizeSkillManifest(manifest),
    (error) => error.code === 'INVALID_SKILL_MANIFEST' && error.reason === reason,
    `beklenen ret: ${reason}`
  );
}

assert.deepEqual(SKILL_MANIFEST_LIMITS.sources, ['builtin', 'user', 'project']);
assert.deepEqual(SKILL_MANIFEST_LIMITS.executions, ['inline', 'fork']);

console.log('skill manifest tests passed');
