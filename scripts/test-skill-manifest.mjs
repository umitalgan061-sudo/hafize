import assert from 'node:assert/strict';
import { SKILL_EXECUTION_MODES, SKILL_LIMITS, SKILL_SOURCES, normalizeSkillManifest } from '../lib/skill-manifest.mjs';

const validInput = {
  id: 'gunluk-ozet',
  name: 'Günlük Özet',
  description: 'Kullanıcının günlük notlarını kısa bir özete dönüştürür.',
  triggers: ['Günlük Özet', 'ozet cikar'],
  allowedTools: ['task.read', 'connector.gmail.read'],
  arguments: [{ name: 'gun', type: 'string', required: true }, { name: 'kisa', type: 'boolean' }],
  model: 'NVIDIA/llama-3.3-70b',
  execution: 'inline',
  prompt: 'Verilen notları maddeler halinde özetle.'
};

const skill = normalizeSkillManifest(validInput, { source: 'builtin' });
assert.deepEqual(skill, {
  id: 'gunluk-ozet',
  source: 'builtin',
  name: 'Günlük Özet',
  description: 'Kullanıcının günlük notlarını kısa bir özete dönüştürür.',
  triggers: ['günlük özet', 'ozet cikar'],
  allowedTools: ['task.read', 'connector.gmail.read'],
  arguments: [{ name: 'gun', type: 'string', required: true }, { name: 'kisa', type: 'boolean', required: false }],
  model: 'nvidia/llama-3.3-70b',
  execution: 'inline',
  prompt: 'Verilen notları maddeler halinde özetle.'
});
assert.equal(Object.isFrozen(skill), true);
assert.equal(Object.isFrozen(skill.triggers), true);
assert.equal(Object.isFrozen(skill.allowedTools), true);
assert.equal(Object.isFrozen(skill.arguments[0]), true);

const minimal = normalizeSkillManifest(
  { id: 'ab', name: 'A', description: 'B', execution: 'fork', prompt: 'C' },
  { source: 'project' }
);
assert.deepEqual(minimal.triggers, []);
assert.deepEqual(minimal.allowedTools, []);
assert.deepEqual(minimal.arguments, []);
assert.equal(minimal.model, 'auto');
assert.equal(minimal.source, 'project');

// Manifest kendi kaynağını seçemez; kaynak yalnız yükleyici tarafından verilir.
assert.throws(() => normalizeSkillManifest(validInput, { source: 'builtin-trusted' }), /INVALID_SKILL_SOURCE/);
assert.throws(() => normalizeSkillManifest(validInput), /INVALID_SKILL_SOURCE/);
assert.throws(
  () => normalizeSkillManifest({ ...validInput, source: 'builtin' }, { source: 'project' }),
  /INVALID_SKILL_FIELD/
);

for (const field of ['toolPolicy', 'approvalGranted', 'systemPrompt', 'env', 'path']) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, [field]: 'x' }, { source: 'user' }), /INVALID_SKILL_FIELD/);
}

for (const id of ['', 'A', 'x', 'has space', 'ust_cizgi', 'a'.repeat(49)]) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, id }, { source: 'user' }), /INVALID_SKILL_ID/);
}

for (const execution of [undefined, 'bypass', 'inline ', 'shell']) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, execution }, { source: 'user' }), /INVALID_SKILL_EXECUTION/);
}
assert.deepEqual(SKILL_EXECUTION_MODES, ['inline', 'fork']);
assert.deepEqual(SKILL_SOURCES, ['builtin', 'user', 'project']);

// Skill onay gerektiren veya asla verilmeyen araçları manifest üzerinden talep edemez.
for (const tool of ['secret.read', 'repo.delete', 'external.write', 'external.send', 'repo.merge', 'repo.write_branch']) {
  assert.throws(
    () => normalizeSkillManifest({ ...validInput, allowedTools: [tool] }, { source: 'user' }),
    /SKILL_TOOL_ESCALATION/
  );
}
for (const tools of [['Task.Read'], ['task.read', 'task.read'], ['x'.repeat(121)], 'task.read']) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, allowedTools: tools }, { source: 'user' }), /INVALID_SKILL_TOOL/);
}

// Prompt, ad, açıklama ve tetikleyiciler credential taşıyamaz.
for (const prompt of [
  'api_key: sk-abcdefghijklmnopqrstuvwx',
  'token ghp_abcdefghijklmnopqrstuvwxyz012345',
  '-----BEGIN RSA PRIVATE KEY-----',
  'AKIAIOSFODNN7EXAMPLE ile giriş yap',
  'client_secret = deneme'
]) {
  assert.throws(
    () => normalizeSkillManifest({ ...validInput, prompt }, { source: 'user' }),
    /SKILL_CREDENTIAL_MATERIAL/
  );
}
assert.throws(
  () => normalizeSkillManifest({ ...validInput, description: 'password: 1234' }, { source: 'user' }),
  /SKILL_CREDENTIAL_MATERIAL/
);

for (const triggers of [['ok', 'OK'], ['@komut'], [''], 'ozet', Array.from({ length: SKILL_LIMITS.maxTriggers + 1 }, (_, i) => `t${i}`)]) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, triggers }, { source: 'user' }), /INVALID_SKILL_TRIGGER/);
}

for (const args of [
  [{ name: 'Gun', type: 'string' }],
  [{ name: 'gun', type: 'object' }],
  [{ name: 'gun', type: 'string' }, { name: 'gun', type: 'string' }],
  Array.from({ length: SKILL_LIMITS.maxArguments + 1 }, (_, i) => ({ name: `a${i}`, type: 'string' }))
]) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, arguments: args }, { source: 'user' }), /INVALID_SKILL_ARGUMENT/);
}
assert.throws(
  () => normalizeSkillManifest({ ...validInput, arguments: [{ name: 'gun', type: 'string', tool: 'x' }] }, { source: 'user' }),
  /INVALID_SKILL_ARGUMENT_FIELD/
);

for (const [field, value, pattern] of [
  ['name', 'x'.repeat(SKILL_LIMITS.maxNameLength + 1), /INVALID_SKILL_NAME/],
  ['name', 'satır\nkırma', /INVALID_SKILL_NAME/],
  ['description', '', /INVALID_SKILL_DESCRIPTION/],
  ['prompt', 'x'.repeat(SKILL_LIMITS.maxPromptLength + 1), /INVALID_SKILL_PROMPT/],
  ['prompt', '\u0000', /INVALID_SKILL_PROMPT/],
  ['model', 'MODEL ADI', /INVALID_SKILL_MODEL/]
]) {
  assert.throws(() => normalizeSkillManifest({ ...validInput, [field]: value }, { source: 'user' }), pattern);
}

for (const input of [null, [], 'skill', 42]) {
  assert.throws(() => normalizeSkillManifest(input, { source: 'user' }), /INVALID_SKILL_MANIFEST|INVALID_SKILL_ID/);
}

console.log('skill manifest tests passed');
