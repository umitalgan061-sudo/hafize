import assert from 'node:assert/strict';
import { SKILL_LIMITS, SKILL_SOURCE_PRECEDENCE, normalizeSkillManifest } from '../lib/skill-manifest.mjs';

const validInput = {
  name: 'release-notes',
  description: 'Sürüm notu taslağı hazırlar.',
  triggers: ['Sürüm notu', 'release notes'],
  allowedTools: ['repo.read', 'runtime.status'],
  arguments: [{ name: 'tag', type: 'string', required: true, description: 'Sürüm etiketi' }],
  model: 'nvidia/llama-3.3-70b-instruct',
  execution: 'inline',
  prompt: 'Verilen etiket için kısa ve doğrulanabilir sürüm notu yaz.'
};
const builtin = (overrides) => normalizeSkillManifest({ ...validInput, ...overrides }, { source: 'builtin' });

const skill = builtin();
assert.equal(skill.name, 'release-notes');
assert.equal(skill.source, 'builtin');
assert.equal(skill.execution, 'inline');
assert.equal(skill.model, 'nvidia/llama-3.3-70b-instruct');
assert.equal(skill.projectScope, null);
assert.deepEqual(skill.triggers, ['sürüm notu', 'release notes']);
assert.deepEqual(skill.allowedTools, ['repo.read', 'runtime.status']);
assert.deepEqual(skill.arguments, [{ name: 'tag', type: 'string', required: true, description: 'Sürüm etiketi' }]);
for (const frozen of [skill, skill.triggers, skill.allowedTools, skill.arguments, skill.arguments[0]]) assert.equal(Object.isFrozen(frozen), true);

// Kaynak sırası belgelenmiş önceliktir ve manifest kendi kaynağını beyan edemez.
assert.deepEqual(SKILL_SOURCE_PRECEDENCE, ['builtin', 'user', 'project']);
for (const source of [undefined, 'system', 'remote', '']) {
  assert.throws(() => normalizeSkillManifest(validInput, { source }), /INVALID_SKILL_SOURCE/);
}

// Bilinmeyen alanlar reddedilir; skill alan uydurarak yetki veya kimlik enjekte edemez.
for (const field of ['toolPolicy', 'approvalGranted', 'owner', 'apiKey', 'systemPrompt']) {
  assert.throws(() => builtin({ [field]: 'x' }), /INVALID_SKILL_FIELD/);
}
for (const input of [null, [], 'skill']) {
  assert.throws(() => normalizeSkillManifest(input, { source: 'builtin' }), /INVALID_SKILL_MANIFEST/);
}

for (const name of [undefined, 'A', 'x', 'has space', 'ünlü', '-lead', 'a'.repeat(65)]) {
  assert.throws(() => builtin({ name }), /INVALID_SKILL_NAME/);
}
for (const execution of [undefined, 'bypass', 'shell', 'INLINE']) {
  assert.throws(() => builtin({ execution }), /INVALID_SKILL_EXECUTION/);
}
assert.equal(normalizeSkillManifest({ ...validInput, execution: 'fork' }, { source: 'user' }).execution, 'fork');

for (const description of ['', '  ', 'satır\nkırma', 'x'.repeat(SKILL_LIMITS.maxDescriptionLength + 1)]) assert.throws(() => builtin({ description }), /INVALID_SKILL_DESCRIPTION/);

for (const triggers of ['metin', ['ayni', 'AYNI'], ['x'.repeat(SKILL_LIMITS.maxTriggerLength + 1)],
  Array.from({ length: SKILL_LIMITS.maxTriggers + 1 }, (_, i) => `t${i}`)]) {
  assert.throws(() => builtin({ triggers }), /INVALID_SKILL_TRIGGERS/);
}
assert.deepEqual(builtin({ triggers: undefined }).triggers, []);

// Yasak yetkiler manifest üzerinden istenemez.
for (const tool of ['secret.read', 'repo.delete']) {
  assert.throws(() => builtin({ allowedTools: [tool] }), /SKILL_TOOL_FORBIDDEN/);
}
for (const allowedTools of ['repo.read', ['repo.read', 'repo.read'], ['Repo.Read'], [''], [42],
  Array.from({ length: SKILL_LIMITS.maxAllowedTools + 1 }, (_, i) => `tool.t${i}`)]) {
  assert.throws(() => builtin({ allowedTools }), /INVALID_SKILL_ALLOWED_TOOLS/);
}
assert.deepEqual(builtin({ allowedTools: undefined }).allowedTools, []);

for (const args of ['tag', [{ name: 'tag' }], [{ name: 'tag', type: 'object' }], [{ name: 'Tag', type: 'string' }],
  [{ name: 'tag', type: 'string', required: 'yes' }], [{ name: 'tag', type: 'string' }, { name: 'tag', type: 'number' }],
  Array.from({ length: SKILL_LIMITS.maxArguments + 1 }, (_, i) => ({ name: `a${i}`, type: 'string' }))]) {
  assert.throws(() => builtin({ arguments: args }), /INVALID_SKILL_ARGUMENTS/);
}
assert.throws(() => builtin({ arguments: [{ name: 'tag', type: 'string', tool: 'x' }] }), /INVALID_SKILL_ARGUMENT_FIELD/);
assert.equal(builtin({ arguments: [{ name: 'tag', type: 'string' }] }).arguments[0].required, false);

for (const model of ['', 'model with space', 'x'.repeat(81), 42]) {
  assert.throws(() => builtin({ model }), /INVALID_SKILL_MODEL/);
}
assert.equal(builtin({ model: undefined }).model, null);

for (const prompt of ['', '\0', 42, 'x'.repeat(SKILL_LIMITS.maxPromptLength + 1)]) {
  assert.throws(() => builtin({ prompt }), /INVALID_SKILL_PROMPT/);
}
// Skill prompt'u credential taşıyamaz.
for (const prompt of ['api_key: sk-test-123', 'Authorization: Bearer abc.def', 'client secret = zzz',
  '-----BEGIN RSA PRIVATE KEY-----']) {
  assert.throws(() => builtin({ prompt }), /SKILL_PROMPT_CREDENTIAL_FORBIDDEN/);
}

// Project skill yalnız açık proje kapsamı bildirerek yüklenebilir.
assert.throws(() => normalizeSkillManifest(validInput, { source: 'project' }), /INVALID_SKILL_PROJECT_SCOPE/);
assert.throws(() => builtin({ projectScope: 'hafize' }), /INVALID_SKILL_PROJECT_SCOPE/);
assert.equal(
  normalizeSkillManifest({ ...validInput, projectScope: 'umitalgan061-sudo/hafize' }, { source: 'project' }).projectScope,
  'umitalgan061-sudo/hafize'
);

console.log('skill manifest tests passed');
