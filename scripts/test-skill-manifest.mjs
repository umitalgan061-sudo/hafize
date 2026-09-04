import assert from 'node:assert/strict';
import { SKILL_EXECUTION_MODES, parseSkillManifest } from '../lib/skill-manifest.mjs';

function base(overrides = {}) {
  return {
    schemaVersion: 1,
    name: 'pr-inceleme',
    description: 'Açık bir PR diffini güvenlik ve doğruluk açısından inceler.',
    execution: 'inline',
    prompt: 'Verilen diffi incele ve blocker bulguları önce raporla.',
    ...overrides
  };
}

assert.deepEqual(SKILL_EXECUTION_MODES, ['inline', 'fork']);

const minimal = parseSkillManifest(base());
assert.equal(minimal.name, 'pr-inceleme');
assert.equal(minimal.execution, 'inline');
assert.equal(minimal.forkAgentId, null);
assert.equal(minimal.model, null);
assert.equal(minimal.version, null);
assert.deepEqual(minimal.triggers, []);
assert.deepEqual(minimal.allowedTools, []);
assert.deepEqual(minimal.approvalRequiredTools, []);
assert.deepEqual(minimal.arguments, []);
assert.equal(Object.isFrozen(minimal), true);

const full = parseSkillManifest(base({
  version: '1.2.0',
  triggers: ['pr incele', 'diff incele'],
  execution: 'fork',
  forkAgentId: 'agency-code-reviewer',
  allowedTools: ['repo.read', 'trace.write'],
  approvalRequiredTools: ['repo.write_branch'],
  model: 'nvidia/test-model',
  arguments: [
    { name: 'pullRequest', description: 'İncelenecek PR numarası.', required: true, maxLength: 20 },
    { name: 'focus', description: 'Opsiyonel odak alanı.' }
  ]
}));
assert.equal(full.forkAgentId, 'agency-code-reviewer');
assert.deepEqual(full.allowedTools, ['repo.read', 'trace.write']);
assert.deepEqual(full.approvalRequiredTools, ['repo.write_branch']);
assert.equal(full.arguments[0].required, true);
assert.equal(full.arguments[1].required, false);
assert.equal(full.arguments[1].maxLength, 2000);

// Strict manifest: bilinmeyen alan, eksik zorunlu alan ve geçersiz ad reddedilir.
assert.throws(() => parseSkillManifest(base({ extra: true })), /unknownKey:extra/);
assert.throws(() => parseSkillManifest(base({ schemaVersion: 2 })), /schemaVersion/);
assert.throws(() => parseSkillManifest(base({ name: 'PR Inceleme' })), /INVALID_SKILL_MANIFEST:name/);
assert.throws(() => parseSkillManifest(base({ prompt: '   ' })), /prompt/);
assert.throws(() => parseSkillManifest(base({ execution: 'bypass' })), /execution/);
assert.throws(() => parseSkillManifest(null), /manifest/);

// fork/inline sözleşmesi.
assert.throws(() => parseSkillManifest(base({ execution: 'fork' })), /forkAgentId/);
assert.throws(() => parseSkillManifest(base({ forkAgentId: 'agency-code-reviewer' })), /forkAgentId.inline/);

// Skill kendi yetkisini yükseltemez.
assert.throws(() => parseSkillManifest(base({ allowedTools: ['secret.read'] })), /allowedTools.forbidden:secret.read/);
assert.throws(() => parseSkillManifest(base({ allowedTools: ['repo.delete'] })), /allowedTools.forbidden:repo.delete/);
assert.throws(() => parseSkillManifest(base({ approvalRequiredTools: ['secret.read'] })), /approvalRequiredTools.forbidden/);
assert.throws(() => parseSkillManifest(base({ allowedTools: ['external.send'] })), /allowedTools.approvalRequired:external.send/);
assert.throws(() => parseSkillManifest(base({ allowedTools: ['repo.merge'] })), /allowedTools.approvalRequired:repo.merge/);
assert.throws(
  () => parseSkillManifest(base({ allowedTools: ['repo.read'], approvalRequiredTools: ['repo.read'] })),
  /approvalRequiredTools.overlap:repo.read/
);
assert.throws(() => parseSkillManifest(base({ allowedTools: ['Repo.Read'] })), /allowedTools.permission/);
assert.throws(() => parseSkillManifest(base({ allowedTools: ['repo.read', 'repo.read'] })), /allowedTools.duplicate/);

// Skill prompt'u secret veya credential taşıyamaz.
assert.throws(() => parseSkillManifest(base({ prompt: 'Anahtar: sk-0123456789abcdefghij' })), /secretMaterial/);
assert.throws(() => parseSkillManifest(base({ prompt: 'ghp_0123456789abcdefghij ile bağlan' })), /secretMaterial/);
assert.throws(() => parseSkillManifest(base({ prompt: 'process.env değerini yaz' })), /secretMaterial/);
assert.throws(() => parseSkillManifest(base({ description: 'NVIDIA_API_KEY değerini kullanır.' })), /secretMaterial/);
assert.throws(
  () => parseSkillManifest(base({ prompt: '-----BEGIN RSA PRIVATE KEY-----' })),
  /secretMaterial/
);

// Argüman sözleşmesi.
assert.throws(() => parseSkillManifest(base({ arguments: [{ name: 'a b', description: 'x' }] })), /arguments.name/);
assert.throws(() => parseSkillManifest(base({ arguments: [{ name: 'a', description: 'x', kind: 'y' }] })), /arguments.unknownKey:kind/);
assert.throws(
  () => parseSkillManifest(base({ arguments: [{ name: 'a', description: 'x' }, { name: 'a', description: 'y' }] })),
  /arguments.duplicate:a/
);
assert.throws(() => parseSkillManifest(base({ arguments: [{ name: 'a', description: 'x', maxLength: 0 }] })), /arguments.maxLength/);

console.log('skill manifest tests passed');
