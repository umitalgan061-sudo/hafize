import assert from 'node:assert/strict';
import { normalizeSkillManifest } from '../lib/skill-manifest.mjs';

const base = {
  id: 'pr-review',
  name: 'PR Review',
  description: 'Açık pull request üzerinde güvenlik odaklı inceleme yapar.',
  triggers: ['PR incele', 'kod incele'],
  allowedTools: ['repo.read', 'pr.read'],
  arguments: [{ name: 'pr_number', required: true, description: 'İncelenecek PR numarası' }],
  execution: 'fork',
  model: 'nvidia/llama-3.3-70b',
  prompt: 'Verilen PR diffini oku ve blocker bulguları önce raporla.'
};

const ok = normalizeSkillManifest(base, { source: 'builtin' });
assert.equal(ok.skill.source, 'builtin');
assert.equal(ok.skill.execution, 'fork');
assert.deepEqual([...ok.skill.triggers], ['pr incele', 'kod incele']);
assert.equal(ok.skill.arguments[0].required, true);
assert.equal(ok.skill.path, '');
assert.throws(() => { ok.skill.id = 'other'; }, TypeError);

// execution varsayılanı inline; model, tool ve argüman opsiyonel.
const bare = { id: 'ozet', name: 'Özet', description: 'Kısa özet çıkarır.', prompt: 'Metni özetle.' };
const minimal = normalizeSkillManifest(bare, { source: 'user' });
assert.equal(minimal.skill.execution, 'inline');
assert.equal(minimal.skill.model, '');
assert.deepEqual([...minimal.skill.allowedTools], []);

// Strict doğrulama: geçersiz alan sessizce düzeltilmez.
const rejects = [
  ['id', { id: 'Bad Id' }],
  ['name', { name: '' }],
  ['description', { description: 'x'.repeat(401) }],
  ['triggers', { triggers: ['a', 'A'] }],
  ['execution', { execution: 'bypass' }],
  ['model', { model: 'model with space' }],
  ['prompt', { prompt: '' }],
  ['arguments', { arguments: [{ name: 'Bad-Name' }] }],
  ['arguments', { arguments: [{ name: 'a', required: 'yes' }] }],
  ['allowedTools', { allowedTools: ['repo.read', 'repo.read'] }],
  // Skill kendi tool yetkisini yükseltemez.
  ...['secret.read', 'repo.delete', 'repo.merge', 'external.send', 'external.write', 'repo.write_branch']
    .map((tool) => ['allowedTools', { allowedTools: [tool] }]),
  // Skill prompt'u secret veya credential taşıyamaz.
  ...[
    'Şu anahtarı kullan: nvapi-0123456789abcdefghij',
    'token ghp_abcdefghijklmnopqrstuvwxyz0123',
    'Authorization: Bearer abcdefghijklmnopqrstuvwx',
    'GITHUB_TOKEN=abc123',
    '-----BEGIN RSA PRIVATE KEY-----'
  ].map((prompt) => ['secretMaterial', { prompt }])
];
for (const [field, overrides] of rejects) {
  assert.deepEqual(
    normalizeSkillManifest({ ...base, ...overrides }, { source: 'builtin' }),
    { ok: false, error: `INVALID_SKILL:${field}` }
  );
}
assert.deepEqual(normalizeSkillManifest(base, { source: 'unknown' }), { ok: false, error: 'INVALID_SKILL:source' });
assert.deepEqual(normalizeSkillManifest(null, { source: 'builtin' }), { ok: false, error: 'INVALID_SKILL:manifest' });

// Project skill yalnız açıkça izin verilen kapsamdan yüklenir.
for (const [options, path] of [
  [{}, 'skills/pr-review.json'],
  [{ projectScope: ['other'] }, 'skills/pr-review.json'],
  [{ projectScope: ['skills'] }, '../etc/passwd'],
  [{ projectScope: ['skills'] }, '/etc/skills/x.json'],
  [{ projectScope: ['skills'] }, 'skillsx/pr-review.json']
]) {
  assert.deepEqual(
    normalizeSkillManifest({ ...base, path }, { source: 'project', ...options }),
    { ok: false, error: 'INVALID_SKILL:projectScope' }
  );
}
const scoped = normalizeSkillManifest({ ...base, path: 'skills/x.json' }, { source: 'project', projectScope: ['skills'] });
assert.equal(scoped.skill.path, 'skills/x.json');

console.log('skill manifest contract OK');
