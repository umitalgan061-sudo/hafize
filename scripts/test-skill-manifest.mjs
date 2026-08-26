import assert from 'node:assert/strict';
import {
  SKILL_MANIFEST_LIMITS,
  SKILL_SOURCE_PRIORITY,
  normalizeSkillManifest
} from '../lib/skill-manifest.mjs';

const validInput = {
  name: 'rapor-ozeti',
  description: 'Uzun raporları kısa özetlere dönüştürür.',
  triggers: ['rapor özetle', 'Özet Çıkar'],
  arguments: [{ name: 'kaynak', type: 'string', required: true }],
  allowedTools: ['task.read', 'trace.write'],
  model: 'nvidia/llama-3.3-70b-instruct',
  execution: 'inline',
  source: 'builtin',
  prompt: 'Verilen raporu maddeler halinde özetle.'
};

const skill = normalizeSkillManifest(validInput);
assert.equal(skill.name, 'rapor-ozeti');
assert.deepEqual(skill.triggers, ['rapor özetle', 'özet çıkar']);
assert.deepEqual(skill.arguments, [{ name: 'kaynak', type: 'string', required: true, description: null }]);
assert.deepEqual(skill.allowedTools, ['task.read', 'trace.write']);
assert.equal(skill.project, null);
assert.equal(Object.isFrozen(skill), true);
assert.equal(Object.isFrozen(skill.triggers), true);
assert.equal(Object.isFrozen(skill.arguments[0]), true);

const projectSkill = normalizeSkillManifest({ ...validInput, source: 'project', project: 'Hafize/App', execution: 'fork' });
assert.equal(projectSkill.project, 'hafize/app');
assert.equal(projectSkill.execution, 'fork');

assert.deepEqual(normalizeSkillManifest({ ...validInput, arguments: undefined, allowedTools: undefined, model: undefined }).allowedTools, []);

for (const input of [null, [], 'skill', { ...validInput, name: undefined }]) {
  assert.throws(() => normalizeSkillManifest(input), /INVALID_SKILL/);
}

for (const field of ['systemPrompt', 'permissions', 'token', 'env']) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, [field]: 'x' }), /INVALID_SKILL_MANIFEST_FIELD/);
}

for (const name of ['', 'Rapor', 'rapor ozeti', '1rapor', 'a'.repeat(65)]) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, name }), /INVALID_SKILL_NAME/);
}

for (const execution of ['inline ', 'async', '', undefined]) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, execution }), /INVALID_SKILL_EXECUTION/);
}

for (const source of ['plugin', '', undefined]) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, source }), /INVALID_SKILL_SOURCE/);
}

assert.throws(() => normalizeSkillManifest({ ...validInput, project: 'hafize' }), /INVALID_SKILL_PROJECT/);
assert.throws(() => normalizeSkillManifest({ ...validInput, source: 'project' }), /INVALID_SKILL_PROJECT/);

const invalidTriggers = [[], ['ok', 'OK'], ['tetik\nkodu'], Array.from({ length: SKILL_MANIFEST_LIMITS.maxTriggers + 1 }, (_, index) => `t-${index}`)];
for (const triggers of invalidTriggers) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, triggers }), /INVALID_SKILL_TRIGGER/);
}

const invalidArguments = [
  [{ name: 'kaynak', type: 'object', required: true }],
  [{ name: 'kaynak', type: 'string' }],
  [{ name: 'kaynak', type: 'string', required: true, tool: 'x' }],
  [{ name: 'kaynak', type: 'string', required: true }, { name: 'kaynak', type: 'string', required: false }]
];
for (const args of invalidArguments) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, arguments: args }), /INVALID_SKILL_ARGUMENT/);
}

for (const tool of ['secret.read', 'repo.delete', 'repo.merge', 'repo.write_branch', 'external.write', 'external.send']) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, allowedTools: [tool] }), /SKILL_TOOL_ESCALATION_FORBIDDEN/);
}

for (const tools of [['task.read', 'task.read'], ['Task.Read'], [''], 'task.read']) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, allowedTools: tools }), /INVALID_SKILL_ALLOWED_TOOL/);
}

const secretPrompts = [
  'AWS anahtarı: AKIA1234567890ABCD',
  'kullan: sk-abcdefghijklmnopqrstuvwx',
  'token ghp_abcdefghijklmnopqrstuvwxyz12',
  'client_secret = super-gizli-deger',
  '-----BEGIN RSA PRIVATE KEY-----'
];
for (const prompt of secretPrompts) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, prompt }), /SKILL_PROMPT_SECRET_FORBIDDEN/);
}

for (const prompt of ['', '   ', 'x'.repeat(SKILL_MANIFEST_LIMITS.maxPromptLength + 1), 42]) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, prompt }), /INVALID_SKILL_PROMPT/);
}

assert.deepEqual(SKILL_SOURCE_PRIORITY, { builtin: 1, user: 2, project: 3 });
console.log('skill manifest tests passed');
