import assert from 'node:assert/strict';
import {
  SKILL_EXECUTION_MODES,
  SKILL_FORBIDDEN_PERMISSIONS,
  SKILL_MANIFEST_LIMITS,
  SKILL_SOURCES,
  normalizeSkillManifest
} from '../lib/skill-manifest.mjs';

const validInput = {
  id: 'release-notes',
  name: 'Sürüm notları',
  description: 'Birleştirilen PR listesinden kısa sürüm notu çıkarır.',
  triggers: ['sürüm notu', 'Release Notes'],
  allowedTools: ['repo.read', 'task.read'],
  arguments: [{ name: 'repository', description: 'owner/repo biçiminde depo.', required: true }],
  model: 'nvidia/llama-3.3-70b-instruct',
  execution: 'fork',
  prompt: 'Verilen PR listesini kullanıcıya uygun kısa sürüm notuna dönüştür.'
};

const skill = normalizeSkillManifest(validInput, { source: 'user' });
assert.deepEqual(skill, {
  id: 'release-notes',
  source: 'user',
  name: 'Sürüm notları',
  description: 'Birleştirilen PR listesinden kısa sürüm notu çıkarır.',
  triggers: ['sürüm notu', 'release notes'],
  allowedTools: ['repo.read', 'task.read'],
  arguments: [{ name: 'repository', description: 'owner/repo biçiminde depo.', required: true }],
  model: 'nvidia/llama-3.3-70b-instruct',
  execution: 'fork',
  prompt: 'Verilen PR listesini kullanıcıya uygun kısa sürüm notuna dönüştür.'
});
assert.equal(Object.isFrozen(skill), true);
assert.equal(Object.isFrozen(skill.allowedTools), true);
assert.equal(Object.isFrozen(skill.arguments[0]), true);

const minimal = normalizeSkillManifest(
  { id: 'ozet', name: 'Özet', description: 'Uzun metni özetler.', prompt: 'Metni özetle.' },
  { source: 'builtin' }
);
assert.deepEqual(minimal.triggers, []);
assert.deepEqual(minimal.allowedTools, []);
assert.deepEqual(minimal.arguments, []);
assert.equal(minimal.model, null);
assert.equal(minimal.execution, 'inline');

for (const source of [undefined, null, 'system', 'BUILTIN', '']) {
  assert.throws(() => normalizeSkillManifest(validInput, { source }), /INVALID_SKILL_SOURCE/);
}
for (const input of [null, [], 'skill', {}]) {
  assert.throws(() => normalizeSkillManifest(input, { source: 'user' }), /INVALID_SKILL/);
}
for (const field of ['toolPolicy', 'apiKey', 'systemMessage', 'source', 'path']) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, [field]: 'x' }, { source: 'user' }), /INVALID_SKILL_FIELD/);
}
for (const id of ['', 'A', 'x', 'has space', 'ok_id', 'a'.repeat(65)]) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, id }, { source: 'user' }), /INVALID_SKILL_ID/);
}
for (const execution of ['bypass', 'INLINE', 'shell', '']) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, execution }, { source: 'user' }), /INVALID_SKILL_EXECUTION/);
}
for (const permission of SKILL_FORBIDDEN_PERMISSIONS) {
  assert.throws(
    () => normalizeSkillManifest({ ...validInput, allowedTools: [permission] }, { source: 'user' }),
    /SKILL_TOOL_FORBIDDEN/
  );
}
for (const tools of [['repo.read', 'repo.read'], ['Repo.Read'], [''], [42], 'repo.read']) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, allowedTools: tools }, { source: 'user' }), /INVALID_SKILL_TOOL/);
}
for (const prompt of [
  'NVIDIA api_key: nv-123456',
  'Bearer abc12345 ile çağır',
  'client_secret değerini kullan',
  '',
  '\0',
  'x'.repeat(SKILL_MANIFEST_LIMITS.maxPromptLength + 1)
]) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, prompt }, { source: 'user' }), /SKILL_PROMPT_SECRET_FORBIDDEN|INVALID_SKILL_PROMPT/);
}
for (const args of [[{ name: 'ok', description: 'x', extra: 1 }], [{ name: '1bad', description: 'x' }], [{ name: 'ok' }], 'x']) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, arguments: args }, { source: 'user' }), /INVALID_SKILL_ARGUMENT/);
}
assert.throws(() => normalizeSkillManifest({ ...validInput, model: 'boşluk var' }, { source: 'user' }), /INVALID_SKILL_MODEL/);
assert.throws(
  () => normalizeSkillManifest({ ...validInput, triggers: Array.from({ length: 13 }, (_, i) => `t${i}`) }, { source: 'user' }),
  /INVALID_SKILL_TRIGGERS/
);

assert.deepEqual(SKILL_SOURCES, ['builtin', 'user', 'project']);
assert.deepEqual(SKILL_EXECUTION_MODES, ['inline', 'fork']);
console.log('skill manifest tests passed');
