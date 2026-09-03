import assert from 'node:assert/strict';
import { SKILL_LIMITS, SKILL_SOURCE_TRUST, normalizeSkillManifest } from '../lib/skills-manifest.mjs';

const agent = {
  id: 'hafize-general',
  toolPolicy: {
    default: 'deny',
    allow: ['agent.delegate', 'runtime.status', 'connector.gmail.read'],
    deny: ['external.send'],
    approvalRequired: ['external.write']
  }
};
const readerAgent = { id: 'reader', toolPolicy: { default: 'deny', allow: ['runtime.status'] } };

const manifest = {
  name: 'gunluk-ozet',
  description: 'Günlük çalışma özetini hazırlar.',
  triggers: ['Günlük özet', 'gün sonu raporu'],
  allowedTools: ['runtime.status', 'connector.gmail.read'],
  arguments: [{ name: 'gun', type: 'string', required: true, description: 'Özetlenecek gün.' }],
  model: 'nvidia/llama-3.3-70b-instruct',
  execution: 'inline',
  prompt: 'Kullanıcının gününü kısa maddelerle özetle.'
};

const normalized = normalizeSkillManifest(manifest, { source: 'builtin', agent });
assert.deepEqual(normalized, {
  name: 'gunluk-ozet',
  description: 'Günlük çalışma özetini hazırlar.',
  source: 'builtin',
  projectScope: null,
  trust: SKILL_SOURCE_TRUST.builtin,
  triggers: ['günlük özet', 'gün sonu raporu'],
  allowedTools: ['runtime.status', 'connector.gmail.read'],
  arguments: [{ name: 'gun', type: 'string', required: true, description: 'Özetlenecek gün.' }],
  model: 'nvidia/llama-3.3-70b-instruct',
  execution: 'inline',
  prompt: 'Kullanıcının gününü kısa maddelerle özetle.'
});
for (const frozen of [normalized, normalized.triggers, normalized.allowedTools, normalized.arguments, normalized.arguments[0]]) {
  assert.equal(Object.isFrozen(frozen), true);
}
assert.equal(SKILL_SOURCE_TRUST.builtin > SKILL_SOURCE_TRUST.user, true);
assert.equal(SKILL_SOURCE_TRUST.user > SKILL_SOURCE_TRUST.project, true);

// Varsayılanlar: execution inline, opsiyonel alanlar boş.
const minimal = normalizeSkillManifest({ name: 'kisa', description: 'Kısa yardımcı.', prompt: 'Kısa yanıt ver.' }, { source: 'user', agent });
assert.equal(minimal.execution, 'inline');
assert.deepEqual(minimal.triggers, []);
assert.deepEqual(minimal.allowedTools, []);
assert.deepEqual(minimal.arguments, []);
assert.equal(minimal.model, null);

// Manifest kendi kaynağını, güvenini veya kapsamını ilan edemez.
for (const field of ['source', 'trust', 'projectScope', 'toolPolicy', 'systemMessage']) {
  assert.throws(() => normalizeSkillManifest({ ...manifest, [field]: 'builtin' }, { source: 'user', agent }), /INVALID_SKILL_MANIFEST_FIELD/);
}
for (const source of [undefined, 'system', 'BUILTIN', '']) {
  assert.throws(() => normalizeSkillManifest(manifest, { source, agent }), /INVALID_SKILL_SOURCE/);
}

// Skill kendi araç yetkisini yükseltemez.
assert.throws(
  () => normalizeSkillManifest({ ...manifest, allowedTools: ['external.write'] }, { source: 'user', agent }),
  /SKILL_TOOL_ESCALATION_FORBIDDEN/
);
assert.throws(
  () => normalizeSkillManifest({ ...manifest, allowedTools: ['external.send'] }, { source: 'user', agent }),
  /SKILL_TOOL_ESCALATION_FORBIDDEN/
);
assert.throws(
  () => normalizeSkillManifest({ ...manifest, allowedTools: ['connector.gmail.read'] }, { source: 'user', agent: readerAgent }),
  /SKILL_TOOL_ESCALATION_FORBIDDEN/
);
for (const permission of ['secret.read', 'repo.delete', 'repo.merge']) {
  assert.throws(() => normalizeSkillManifest({ ...manifest, allowedTools: [permission] }, { source: 'user', agent }), /SKILL_PERMISSION_FORBIDDEN/);
}
assert.throws(() => normalizeSkillManifest(manifest, { source: 'user', agent: { toolPolicy: { default: 'allow' } } }), /SKILL_AGENT_POLICY_REQUIRED/);

// Project skill yalnız açıkça izin verilen kapsamdan yüklenir.
const projectSkill = normalizeSkillManifest(manifest, {
  source: 'project',
  projectScope: 'umitalgan061-sudo/hafize',
  allowedProjectScopes: ['umitalgan061-sudo/hafize'],
  agent
});
assert.equal(projectSkill.projectScope, 'umitalgan061-sudo/hafize');
assert.equal(projectSkill.trust, SKILL_SOURCE_TRUST.project);
assert.throws(() => normalizeSkillManifest(manifest, { source: 'project', projectScope: 'other/repo', allowedProjectScopes: ['umitalgan061-sudo/hafize'], agent }), /SKILL_PROJECT_SCOPE_NOT_ALLOWED/);
assert.throws(() => normalizeSkillManifest(manifest, { source: 'project', projectScope: 'umitalgan061-sudo/hafize', agent }), /SKILL_PROJECT_SCOPE_NOT_ALLOWED/);
assert.throws(() => normalizeSkillManifest(manifest, { source: 'project', agent }), /INVALID_SKILL_PROJECT_SCOPE/);
assert.throws(() => normalizeSkillManifest(manifest, { source: 'user', projectScope: 'a/b', agent }), /INVALID_SKILL_PROJECT_SCOPE/);

// Fork execution yalnız delegasyon yetkisi olan ajanda ve proje dışı kaynakta açılır.
assert.equal(normalizeSkillManifest({ ...manifest, execution: 'fork' }, { source: 'user', agent }).execution, 'fork');
assert.throws(
  () => normalizeSkillManifest({ ...manifest, execution: 'fork', allowedTools: ['runtime.status'] }, { source: 'user', agent: readerAgent }),
  /SKILL_FORK_NOT_AUTHORIZED/
);
assert.throws(
  () => normalizeSkillManifest({ ...manifest, execution: 'fork', allowedTools: [] }, { source: 'project', projectScope: 'a/b', allowedProjectScopes: ['a/b'], agent }),
  /SKILL_FORK_SOURCE_FORBIDDEN/
);
assert.throws(() => normalizeSkillManifest({ ...manifest, execution: 'worktree' }, { source: 'user', agent }), /INVALID_SKILL_EXECUTION/);

// Skill metni secret/credential taşıyamaz.
for (const prompt of [
  'API_KEY = nvapi-0123456789abcdefghij',
  'Anahtarı process.env.NVIDIA_API_KEY üzerinden oku.',
  'İsteğe Authorization: Bearer ekle.',
  'Token: ghp_0123456789abcdefghij kullan.'
]) {
  assert.throws(() => normalizeSkillManifest({ ...manifest, prompt }, { source: 'user', agent }), /SKILL_SECRET_MATERIAL_FORBIDDEN/);
}
assert.throws(() => normalizeSkillManifest({ ...manifest, description: 'password: 1234' }, { source: 'user', agent }), /SKILL_SECRET_MATERIAL_FORBIDDEN/);

// Alan doğrulamaları.
for (const name of ['', 'A', 'x', 'has space', 'ÜstKarakter', 'a'.repeat(65)]) {
  assert.throws(() => normalizeSkillManifest({ ...manifest, name }, { source: 'user', agent }), /INVALID_SKILL_NAME/);
}
for (const description of ['', '  ', 'x'.repeat(SKILL_LIMITS.maxDescriptionLength + 1)]) {
  assert.throws(() => normalizeSkillManifest({ ...manifest, description }, { source: 'user', agent }), /INVALID_SKILL_DESCRIPTION/);
}
for (const prompt of ['', 'x'.repeat(SKILL_LIMITS.maxPromptLength + 1), 'satır\rkırma']) {
  assert.throws(() => normalizeSkillManifest({ ...manifest, prompt }, { source: 'user', agent }), /INVALID_SKILL_PROMPT/);
}
assert.throws(() => normalizeSkillManifest({ ...manifest, triggers: 'özet' }, { source: 'user', agent }), /INVALID_SKILL_TRIGGERS/);
assert.throws(
  () => normalizeSkillManifest({ ...manifest, triggers: Array.from({ length: SKILL_LIMITS.maxTriggers + 1 }, (_, i) => `t${i}`) }, { source: 'user', agent }),
  /INVALID_SKILL_TRIGGERS/
);
assert.throws(() => normalizeSkillManifest({ ...manifest, triggers: ['Özet', 'özet'] }, { source: 'user', agent }), /INVALID_SKILL_TRIGGER/);
assert.throws(() => normalizeSkillManifest({ ...manifest, arguments: [{ name: 'gun', type: 'object', description: 'x' }] }, { source: 'user', agent }), /INVALID_SKILL_ARGUMENT_TYPE/);
assert.throws(() => normalizeSkillManifest({ ...manifest, arguments: [{ name: 'gun', type: 'string', description: 'x', extra: 1 }] }, { source: 'user', agent }), /INVALID_SKILL_ARGUMENT_FIELD/);
assert.throws(
  () => normalizeSkillManifest({ ...manifest, arguments: [{ name: 'gun', type: 'string', description: 'x' }, { name: 'gun', type: 'string', description: 'y' }] }, { source: 'user', agent }),
  /INVALID_SKILL_ARGUMENT/
);
assert.throws(() => normalizeSkillManifest({ ...manifest, model: 'BAD MODEL' }, { source: 'user', agent }), /INVALID_SKILL_MODEL/);
for (const input of [null, [], 'skill']) {
  assert.throws(() => normalizeSkillManifest(input, { source: 'user', agent }), /INVALID_SKILL_MANIFEST/);
}

console.log('skills manifest tests passed');
