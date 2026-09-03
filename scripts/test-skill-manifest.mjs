import assert from 'node:assert/strict';
import {
  SKILL_MANIFEST_LIMITS,
  SKILL_SOURCE_PRECEDENCE,
  normalizeSkillManifest
} from '../lib/skill-manifest.mjs';

const validInput = {
  name: 'gunluk-ozet',
  description: 'Günlük görev ve takvim özetini hazırlar.',
  triggers: ['Günlük özet', 'gunluk rapor'],
  allowedTools: ['task.read', 'connector.gmail.read'],
  approvalRequiredTools: ['external.send'],
  arguments: [{ name: 'gun', type: 'string', required: true, description: 'ISO tarih' }],
  model: 'nvidia/llama-3.3-70b-instruct',
  execution: 'inline',
  prompt: 'Kullanıcının o güne ait görevlerini özetle.'
};

const skill = normalizeSkillManifest(validInput, { source: 'builtin' });
assert.deepEqual(skill, {
  name: 'gunluk-ozet',
  source: 'builtin',
  precedence: SKILL_SOURCE_PRECEDENCE.builtin,
  description: 'Günlük görev ve takvim özetini hazırlar.',
  triggers: ['günlük özet', 'gunluk rapor'],
  allowedTools: ['task.read', 'connector.gmail.read'],
  approvalRequiredTools: ['external.send'],
  arguments: [{ name: 'gun', type: 'string', required: true, description: 'ISO tarih' }],
  model: 'nvidia/llama-3.3-70b-instruct',
  execution: 'inline',
  prompt: 'Kullanıcının o güne ait görevlerini özetle.'
});
assert.equal(Object.isFrozen(skill), true);
assert.equal(Object.isFrozen(skill.allowedTools), true);
assert.equal(Object.isFrozen(skill.arguments[0]), true);

// Kaynak önceliği: builtin > user > project.
assert.equal(SKILL_SOURCE_PRECEDENCE.builtin > SKILL_SOURCE_PRECEDENCE.user, true);
assert.equal(SKILL_SOURCE_PRECEDENCE.user > SKILL_SOURCE_PRECEDENCE.project, true);
assert.equal(normalizeSkillManifest(validInput, { source: 'user' }).precedence, SKILL_SOURCE_PRECEDENCE.user);

// Project skill yalnız açıkça izin verilen proje kapsamında yüklenir.
assert.throws(() => normalizeSkillManifest(validInput, { source: 'project' }), /SKILL_PROJECT_SCOPE_NOT_ALLOWED/);
assert.equal(
  normalizeSkillManifest(validInput, { source: 'project', projectScopeAllowed: true }).source,
  'project'
);
for (const source of [undefined, null, 'plugin', 'BUILTIN']) {
  assert.throws(() => normalizeSkillManifest(validInput, { source }), /INVALID_SKILL_SOURCE/);
}

// Strict manifest: bilinmeyen alan ve tanımsız gövde reddedilir.
for (const field of ['toolPolicy', 'systemPrompt', 'token', 'path', 'env']) {
  assert.throws(
    () => normalizeSkillManifest({ ...validInput, [field]: 'x' }, { source: 'builtin' }),
    /INVALID_SKILL_FIELD/
  );
}
for (const input of [null, [], 'skill', {}]) {
  assert.throws(() => normalizeSkillManifest(input, { source: 'builtin' }), /INVALID_SKILL_/);
}

for (const name of ['', 'A', 'x', 'has space', 'Üst', 'a'.repeat(65), '-lead']) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, name }, { source: 'builtin' }), /INVALID_SKILL_NAME/);
}

for (const execution of [undefined, 'shell', 'INLINE', 'worktree']) {
  assert.throws(
    () => normalizeSkillManifest({ ...validInput, execution }, { source: 'builtin' }),
    /INVALID_SKILL_EXECUTION/
  );
}
assert.equal(normalizeSkillManifest({ ...validInput, execution: 'fork' }, { source: 'builtin' }).execution, 'fork');

for (const description of ['', '  ', 'çok\nuzun', 'x'.repeat(SKILL_MANIFEST_LIMITS.maxDescriptionLength + 1)]) {
  assert.throws(
    () => normalizeSkillManifest({ ...validInput, description }, { source: 'builtin' }),
    /INVALID_SKILL_DESCRIPTION/
  );
}

for (const triggers of [
  'ozet',
  ['ozet', 'OZET'],
  [''],
  ['x'.repeat(SKILL_MANIFEST_LIMITS.maxTriggerLength + 1)],
  Array.from({ length: SKILL_MANIFEST_LIMITS.maxTriggers + 1 }, (_, index) => `t${index}`)
]) {
  assert.throws(
    () => normalizeSkillManifest({ ...validInput, triggers }, { source: 'builtin' }),
    /INVALID_SKILL_TRIGGERS/
  );
}
assert.deepEqual(normalizeSkillManifest({ ...validInput, triggers: undefined }, { source: 'builtin' }).triggers, []);

// Skill kendi tool yetkisini yükseltemez.
for (const tool of ['secret.read', 'repo.delete']) {
  assert.throws(
    () => normalizeSkillManifest({ ...validInput, allowedTools: [tool] }, { source: 'builtin' }),
    /SKILL_FORBIDDEN_TOOL/
  );
  assert.throws(
    () => normalizeSkillManifest({ ...validInput, approvalRequiredTools: [tool] }, { source: 'builtin' }),
    /SKILL_FORBIDDEN_TOOL/
  );
}
for (const tool of ['external.write', 'external.send', 'repo.merge', 'repo.write_branch']) {
  assert.throws(
    () => normalizeSkillManifest({ ...validInput, allowedTools: [tool] }, { source: 'builtin' }),
    /SKILL_APPROVAL_REQUIRED_TOOL/
  );
  assert.equal(
    normalizeSkillManifest({ ...validInput, allowedTools: [], approvalRequiredTools: [tool] }, { source: 'builtin' })
      .approvalRequiredTools.includes(tool),
    true
  );
}
for (const allowedTools of [
  'task.read',
  ['task.read', 'task.read'],
  ['Task.Read'],
  ['task read'],
  ['task.read'].concat(Array.from({ length: SKILL_MANIFEST_LIMITS.maxTools }, (_, index) => `t.read${index}`))
]) {
  assert.throws(
    () => normalizeSkillManifest({ ...validInput, allowedTools }, { source: 'builtin' }),
    /INVALID_SKILL_TOOLS/
  );
}
assert.throws(
  () => normalizeSkillManifest(
    { ...validInput, allowedTools: ['task.read'], approvalRequiredTools: ['task.read'] },
    { source: 'builtin' }
  ),
  /INVALID_SKILL_TOOLS/
);

for (const args of [
  'gun',
  [{ name: 'gun', type: 'object' }],
  [{ name: 'Gun', type: 'string' }],
  [{ name: 'gun', type: 'string' }, { name: 'gun', type: 'string' }],
  [{ name: 'gun', type: 'string', required: 'yes' }],
  Array.from({ length: SKILL_MANIFEST_LIMITS.maxArguments + 1 }, (_, index) => ({ name: `a${index}`, type: 'string' }))
]) {
  assert.throws(
    () => normalizeSkillManifest({ ...validInput, arguments: args }, { source: 'builtin' }),
    /INVALID_SKILL_ARGUMENTS/
  );
}
assert.throws(
  () => normalizeSkillManifest({ ...validInput, arguments: [{ name: 'gun', type: 'string', tool: 'x' }] }, { source: 'builtin' }),
  /INVALID_SKILL_ARGUMENT_FIELD/
);
assert.equal(
  normalizeSkillManifest({ ...validInput, arguments: [{ name: 'gun', type: 'number' }] }, { source: 'builtin' })
    .arguments[0].required,
  false
);

for (const model of ['', 'model with space', 'x'.repeat(121), 'Model/Upper']) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, model }, { source: 'builtin' }), /INVALID_SKILL_MODEL/);
}
assert.equal(normalizeSkillManifest({ ...validInput, model: undefined }, { source: 'builtin' }).model, null);

// Skill prompt'u secret veya credential taşıyamaz.
for (const prompt of [
  'Anahtar: process.env.NVIDIA_API_KEY kullan.',
  'token sk-abcdef0123456789 ile bağlan',
  'nvapi-0123456789abcdef anahtarını kullan',
  'ghp_0123456789abcdef0123 ile push et',
  '-----BEGIN RSA PRIVATE KEY-----',
  'api_key: 12345',
  'client-secret = abc'
]) {
  assert.throws(
    () => normalizeSkillManifest({ ...validInput, prompt }, { source: 'builtin' }),
    /SKILL_PROMPT_CREDENTIAL_FORBIDDEN/
  );
}
for (const prompt of ['', '   ', '\0', 42, 'x'.repeat(SKILL_MANIFEST_LIMITS.maxPromptLength + 1)]) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, prompt }, { source: 'builtin' }), /INVALID_SKILL_PROMPT/);
}

console.log('skill manifest contract tests passed');
