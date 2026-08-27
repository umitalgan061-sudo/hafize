import assert from 'node:assert/strict';
import { SKILL_LIMITS, normalizeSkillArguments, normalizeSkillManifest } from '../lib/skill-manifest.mjs';

const validManifest = {
  id: 'daily-brief',
  name: 'Günlük Özet',
  description: 'Kullanıcının gününü kısa ve okunur bir özete dönüştürür.',
  execution: 'inline',
  triggers: ['Günlük Özet', 'brief'],
  allowedTools: ['task.read', 'connector.gmail.read'],
  arguments: [
    { name: 'day', type: 'string', required: true, maxLength: 40 },
    { name: 'detailed', type: 'boolean' }
  ],
  model: 'nvidia/llama-3.3-70b-instruct',
  prompt: 'Kullanıcının gününü özetle ve önemli maddeleri listele.'
};

const skill = normalizeSkillManifest(validManifest);
assert.equal(skill.id, 'daily-brief');
assert.equal(skill.execution, 'inline');
assert.deepEqual(skill.triggers, ['günlük özet', 'brief']);
assert.deepEqual(skill.allowedTools, ['task.read', 'connector.gmail.read']);
assert.deepEqual(skill.arguments[0], { name: 'day', type: 'string', required: true, maxLength: 40 });
assert.equal(skill.arguments[1].required, false);
assert.equal(skill.arguments[1].maxLength, SKILL_LIMITS.maxArgumentLength);
assert.equal(Object.isFrozen(skill), true);
assert.equal(Object.isFrozen(skill.triggers), true);
assert.equal(Object.isFrozen(skill.arguments[0]), true);

assert.equal(normalizeSkillManifest({ ...validManifest, execution: 'fork', model: undefined }).model, null);
assert.deepEqual(normalizeSkillManifest({ ...validManifest, triggers: undefined, allowedTools: undefined, arguments: undefined }).triggers, []);

for (const field of ['source', 'permissions', 'env', 'apiKey', 'ownerId']) {
  assert.throws(() => normalizeSkillManifest({ ...validManifest, [field]: 'x' }), /INVALID_SKILL_MANIFEST_FIELD/);
}
for (const input of [null, [], 'skill', 42]) {
  assert.throws(() => normalizeSkillManifest(input), /INVALID_SKILL_MANIFEST/);
}
for (const id of ['', 'A', 'has space', 'x', 'ünlü', 'a'.repeat(65)]) {
  assert.throws(() => normalizeSkillManifest({ ...validManifest, id }), /INVALID_SKILL_ID/);
}
for (const execution of ['bypass', 'shell', '', undefined]) {
  assert.throws(() => normalizeSkillManifest({ ...validManifest, execution }), /INVALID_SKILL_EXECUTION/);
}

// Skill kendi tool yetkisini yükseltemez.
for (const tool of ['secret.read', 'repo.delete', 'external.write', 'external.send', 'repo.merge', 'repo.write_branch']) {
  assert.throws(() => normalizeSkillManifest({ ...validManifest, allowedTools: [tool] }), /SKILL_TOOL_ESCALATION_DENIED/);
}
for (const tools of [['task.read', 'task.read'], ['Task.Read'], [''], ['*'], 'task.read']) {
  assert.throws(() => normalizeSkillManifest({ ...validManifest, allowedTools: tools }), /INVALID_SKILL_ALLOWED_TOOLS/);
}

// Skill prompt'u credential taşıyamaz.
for (const prompt of [
  'api_key: sk-live-1234',
  'Kullan: PASSWORD=hunter2',
  'authorization bearer = abcdef',
  'client_secret : xyz'
]) {
  assert.throws(() => normalizeSkillManifest({ ...validManifest, prompt }), /SKILL_PROMPT_CREDENTIAL_DENIED/);
}
for (const prompt of ['', '   ', '\0', 'x'.repeat(SKILL_LIMITS.maxPromptLength + 1), 42]) {
  assert.throws(() => normalizeSkillManifest({ ...validManifest, prompt }), /INVALID_SKILL_PROMPT/);
}

for (const args of [
  [{ name: 'day', type: 'string' }, { name: 'day', type: 'boolean' }],
  [{ name: 'Day', type: 'string' }],
  [{ name: 'day', type: 'object' }],
  [{ name: 'day', type: 'boolean', maxLength: 10 }],
  [{ name: 'day', type: 'string', maxLength: 0 }],
  [{ name: 'day', type: 'string', required: 'yes' }],
  Array.from({ length: SKILL_LIMITS.maxArguments + 1 }, (_, index) => ({ name: `a${index}`, type: 'string' }))
]) {
  assert.throws(() => normalizeSkillManifest({ ...validManifest, arguments: args }), /INVALID_SKILL_ARGUMENTS/);
}
assert.throws(
  () => normalizeSkillManifest({ ...validManifest, arguments: [{ name: 'day', type: 'string', default: 'x' }] }),
  /INVALID_SKILL_ARGUMENT_FIELD/
);
assert.throws(() => normalizeSkillManifest({ ...validManifest, model: 'model name!' }), /INVALID_SKILL_MODEL/);

const values = normalizeSkillArguments(skill, { day: '  bugün  ', detailed: true });
assert.deepEqual(values, { day: 'bugün', detailed: true });
assert.equal(Object.isFrozen(values), true);
assert.deepEqual(normalizeSkillArguments(skill, { day: 'dün', detailed: null }), { day: 'dün' });
assert.throws(() => normalizeSkillArguments(skill, { day: 'x', extra: 1 }), /UNDECLARED_SKILL_ARGUMENT/);
assert.throws(() => normalizeSkillArguments(skill, { detailed: true }), /MISSING_SKILL_ARGUMENT/);
assert.throws(() => normalizeSkillArguments(skill, { day: 'x'.repeat(41) }), /INVALID_SKILL_ARGUMENT_VALUE/);
assert.throws(() => normalizeSkillArguments(skill, { day: 42 }), /INVALID_SKILL_ARGUMENT_VALUE/);
assert.throws(() => normalizeSkillArguments(skill, { day: 'x', detailed: 'true' }), /INVALID_SKILL_ARGUMENT_VALUE/);
assert.throws(() => normalizeSkillArguments(skill, null), /INVALID_SKILL_ARGUMENT_VALUES/);

const numeric = normalizeSkillManifest({ ...validManifest, arguments: [{ name: 'limit', type: 'number', required: true }] });
assert.deepEqual(normalizeSkillArguments(numeric, { limit: 5 }), { limit: 5 });
assert.throws(() => normalizeSkillArguments(numeric, { limit: Number.NaN }), /INVALID_SKILL_ARGUMENT_VALUE/);

console.log('skill manifest tests passed');
