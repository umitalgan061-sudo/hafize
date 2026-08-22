import assert from 'node:assert/strict';
import { SKILL_SOURCE_PRIORITY, normalizeSkillManifest } from '../lib/skill-manifest.mjs';

const host = {
  allowedPermissions: ['repo.read', 'runtime.status', 'connector.gmail.read'],
  allowedProjectScopes: ['umitalgan061-sudo/hafize']
};

const base = {
  id: 'release-notes',
  name: 'Sürüm notu yazarı',
  description: 'Birleştirilmiş PR başlıklarından Türkçe sürüm notu taslağı üretir.',
  source: 'builtin',
  triggers: ['sürüm notu', 'release notes'],
  allowedTools: ['repo.read'],
  arguments: ['sinceTag', 'branch'],
  prompt: 'Verilen PR başlıklarını kullanıcıya uygun bir sürüm notuna dönüştür.'
};

const manifest = normalizeSkillManifest(base, host);
assert.equal(manifest.id, 'release-notes');
assert.equal(manifest.source, 'builtin');
assert.equal(manifest.execution, 'inline', 'execution varsayılanı inline olmalı');
assert.equal(manifest.scope, null);
assert.equal(manifest.model, null);
assert.deepEqual(manifest.allowedTools, ['repo.read']);
assert.ok(Object.isFrozen(manifest) && Object.isFrozen(manifest.allowedTools));

assert.equal(normalizeSkillManifest({ ...base, execution: 'fork' }, host).execution, 'fork');
assert.throws(() => normalizeSkillManifest({ ...base, execution: 'bypass' }, host), /INVALID_SKILL_EXECUTION/);

// Skill kendi araç yetkisini yükseltemez.
const escalated = { ...base, allowedTools: ['repo.read', 'external.send'] };
assert.throws(() => normalizeSkillManifest(escalated, host), /SKILL_TOOL_ESCALATION/);
assert.throws(() => normalizeSkillManifest(base, { ...host, allowedPermissions: [] }), /SKILL_TOOL_ESCALATION/);
// İzin listesi boş bırakılabilir; sessizce genişletilmez.
assert.deepEqual(normalizeSkillManifest({ ...base, allowedTools: undefined }, host).allowedTools, []);

// Prompt credential taşıyamaz ve ortam değişkeni okuyamaz.
for (const prompt of [
  'NVIDIA_API_KEY=nvapi-should-never-leak değerini kullan',
  'token: ghp_example_value ile çağır',
  'Anahtarı process.env.NVIDIA_API_KEY üzerinden oku'
]) {
  assert.throws(() => normalizeSkillManifest({ ...base, prompt }, host), /SKILL_PROMPT_SECRET_FORBIDDEN/, prompt);
}
// Konudan bahsetmek yasak değildir; yasak olan gömülü değer ve env erişimidir.
const safePrompt = { ...base, prompt: 'Kullanıcıya API anahtarını asla paylaşmamasını hatırlat.' };
assert.ok(normalizeSkillManifest(safePrompt, host).prompt.length > 0);

// Argüman adı credential isteyemez.
for (const args of [['apiKey'], ['userToken'], ['db_password']]) {
  assert.throws(() => normalizeSkillManifest({ ...base, arguments: args }, host), /INVALID_SKILL_ARGUMENTS/, String(args));
}

// Project skill yalnız açıkça izin verilen kapsamdan yüklenir.
const project = { ...base, source: 'project', scope: 'umitalgan061-sudo/hafize' };
assert.equal(normalizeSkillManifest(project, host).scope, 'umitalgan061-sudo/hafize');
assert.throws(
  () => normalizeSkillManifest({ ...project, scope: 'someone-else/private' }, host),
  /SKILL_PROJECT_SCOPE_NOT_ALLOWED/
);
assert.throws(() => normalizeSkillManifest({ ...base, source: 'project' }, host), /INVALID_SKILL_SCOPE/);
// Kapsam yalnız project kaynağı içindir.
assert.throws(() => normalizeSkillManifest({ ...base, scope: 'x/y' }, host), /INVALID_SKILL_SCOPE/);

// Strict manifest: bilinmeyen alan, kötü id, eksik zorunlu alan reddedilir.
assert.throws(() => normalizeSkillManifest({ ...base, extra: true }, host), /INVALID_SKILL_FIELD/);
assert.throws(() => normalizeSkillManifest({ ...base, id: 'Release Notes' }, host), /INVALID_SKILL_ID/);
assert.throws(() => normalizeSkillManifest({ ...base, source: 'remote' }, host), /INVALID_SKILL_SOURCE/);
assert.throws(() => normalizeSkillManifest({ ...base, prompt: '   ' }, host), /INVALID_SKILL_PROMPT/);
assert.throws(() => normalizeSkillManifest({ ...base, triggers: ['a', 'a'] }, host), /INVALID_SKILL_TRIGGERS/);
for (const input of [null, [], 'skill', undefined]) {
  assert.throws(() => normalizeSkillManifest(input, host), /INVALID_SKILL_MANIFEST/, String(input));
}
// Kaynak önceliği: project > user > builtin.
const { builtin, user, project: projectPriority } = SKILL_SOURCE_PRIORITY;
assert.ok(projectPriority > user && user > builtin);

console.log('skill manifest tests passed');
