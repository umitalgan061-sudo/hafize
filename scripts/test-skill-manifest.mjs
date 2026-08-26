import assert from 'node:assert/strict';
import {
  SKILL_EXECUTION_MODES,
  SKILL_SOURCES,
  containsCredentialLike,
  normalizeSkillManifest,
  publicSkillView
} from '../lib/skill-manifest.mjs';

function baseManifest(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'daily-brief',
    name: 'Günlük Özet',
    description: 'Kullanıcının gününü özetler.',
    source: 'builtin',
    prompt: 'Kullanıcının günlük notlarını kısa maddelerle özetle.',
    ...overrides
  };
}

assert.deepEqual([...SKILL_SOURCES], ['builtin', 'user', 'project']);
assert.deepEqual([...SKILL_EXECUTION_MODES], ['inline', 'fork']);

const minimal = normalizeSkillManifest(baseManifest());
assert.equal(minimal.execution, 'inline');
assert.equal(minimal.model, null);
assert.equal(minimal.projectScope, null);
assert.deepEqual(minimal.triggers, []);
assert.deepEqual(minimal.allowedTools, []);
assert.deepEqual(minimal.arguments, []);
assert.equal(Object.isFrozen(minimal), true);

const full = normalizeSkillManifest(baseManifest({
  execution: 'fork',
  model: 'nvidia/llama-3.3-70b-instruct',
  triggers: ['günlük özet', 'Günü Topla'],
  allowedTools: ['task.read', 'connector.gmail.read'],
  arguments: [{ name: 'day', type: 'string', required: true, description: 'Hangi gün?' }, { name: 'limit', type: 'number' }]
}));
assert.equal(full.execution, 'fork');
assert.deepEqual([...full.allowedTools], ['task.read', 'connector.gmail.read']);
assert.equal(full.arguments[0].required, true);
assert.equal(full.arguments[1].required, false);
assert.equal(full.arguments[1].description, '');

// Zorunlu alan ve şema doğrulaması.
for (const [overrides, pattern] of [
  [{ schemaVersion: 2 }, /schemaVersion/],
  [{ id: 'Daily Brief' }, /INVALID_SKILL_MANIFEST:id/],
  [{ source: 'remote' }, /INVALID_SKILL_MANIFEST:source/],
  [{ execution: 'bypass' }, /INVALID_SKILL_MANIFEST:execution/],
  [{ description: '   ' }, /INVALID_SKILL_MANIFEST:description/],
  [{ prompt: undefined }, /INVALID_SKILL_MANIFEST:prompt/],
  [{ model: 'bad model!' }, /INVALID_SKILL_MANIFEST:model/],
  [{ triggers: ['aynı', 'AYNI'] }, /triggers.duplicate/],
  [{ allowedTools: ['task.read', 'task.read'] }, /allowedTools.duplicate/],
  [{ arguments: [{ name: 'x', type: 'object' }] }, /arguments.type/],
  [{ arguments: [{ name: '1bad', type: 'string' }] }, /arguments.name/],
  [{ arguments: [{ name: 'a', type: 'string' }, { name: 'a', type: 'number' }] }, /arguments.duplicate:a/]
]) {
  assert.throws(() => normalizeSkillManifest(baseManifest(overrides)), pattern);
}
assert.throws(() => normalizeSkillManifest(null), /INVALID_SKILL_MANIFEST:manifest/);

// Skill kendi yetkisini yükseltemez: yasak ve onay gerektiren izinler manifestte reddedilir.
for (const permission of ['secret.read', 'repo.delete', 'repo.merge']) {
  assert.throws(() => normalizeSkillManifest(baseManifest({ allowedTools: [permission] })), /allowedTools.forbidden/);
}
for (const permission of ['external.write', 'external.send', 'repo.write_branch']) {
  assert.throws(() => normalizeSkillManifest(baseManifest({ allowedTools: [permission] })), /allowedTools.approvalRequired/);
}

// Project skill yalnız açıkça izin verilen kapsamdan yüklenir.
const projectManifest = baseManifest({ source: 'project', projectScope: 'umitalgan061-sudo/hafize' });
assert.throws(() => normalizeSkillManifest(projectManifest), /projectScope.notAllowed/);
assert.throws(() => normalizeSkillManifest(baseManifest({ source: 'project' })), /INVALID_SKILL_MANIFEST:projectScope/);
assert.throws(() => normalizeSkillManifest(baseManifest({ projectScope: 'x' })), /projectScope.unexpected/);
const projectSkill = normalizeSkillManifest(projectManifest, { allowedProjectScopes: ['umitalgan061-sudo/hafize'] });
assert.equal(projectSkill.projectScope, 'umitalgan061-sudo/hafize');

// Skill prompt'u veya açıklaması secret/credential taşıyamaz.
assert.equal(containsCredentialLike('normal bir metin'), false);
for (const secret of [
  'NVIDIA anahtarı: nvapi-abcdefghijklmnopqrstuvwx',
  'client_secret = 12345',
  'Authorization: Bearer abcdefghijklmnopqrstuvwxyz',
  '-----BEGIN RSA PRIVATE KEY-----',
  'aws AKIAIOSFODNN7EXAMPLE kullan'
]) {
  assert.equal(containsCredentialLike(secret), true);
  assert.throws(() => normalizeSkillManifest(baseManifest({ prompt: secret })), /prompt.secret/);
}
assert.throws(() => normalizeSkillManifest(baseManifest({ description: 'api_key: sk-live-abcdefghijklmnopqrst' })), /prompt.secret/);

// Public görünüm prompt veya ham izin listesi sızdırmaz.
const view = publicSkillView(full);
assert.equal('prompt' in view, false);
assert.equal('allowedTools' in view, false);
assert.equal(view.id, 'daily-brief');

console.log('skill-manifest contract ok');
