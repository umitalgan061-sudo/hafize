import assert from 'node:assert/strict';
import {
  SKILL_EXECUTION_MODES,
  SKILL_MANIFEST_LIMITS,
  SKILL_SOURCES,
  normalizeSkillManifest
} from '../lib/skill-manifest.mjs';

const validInput = {
  name: 'gunluk-ozet',
  description: 'Günlük gelen kutusu ve görev özetini hazırlar.',
  triggers: ['Günlük özet', 'inbox özeti'],
  tools: ['connector.gmail.read', 'task.read'],
  arguments: [{ name: 'gun', type: 'string', required: true, description: 'Özetlenecek gün.' }],
  model: 'nvidia/llama-3.3-70b-instruct',
  execution: 'fork',
  prompt: 'Kullanıcının gününü kısa maddelerle özetle.'
};
const rejects = (overrides, pattern, options = { source: 'user' }) =>
  assert.throws(() => normalizeSkillManifest({ ...validInput, ...overrides }, options), pattern);

const skill = normalizeSkillManifest(validInput, { source: 'user' });
assert.deepEqual(skill, {
  name: 'gunluk-ozet',
  source: 'user',
  description: 'Günlük gelen kutusu ve görev özetini hazırlar.',
  triggers: ['günlük özet', 'inbox özeti'],
  tools: ['connector.gmail.read', 'task.read'],
  arguments: [{ name: 'gun', type: 'string', required: true, description: 'Özetlenecek gün.' }],
  model: 'nvidia/llama-3.3-70b-instruct',
  execution: 'fork',
  prompt: 'Kullanıcının gününü kısa maddelerle özetle.'
});
assert.equal(Object.isFrozen(skill) && Object.isFrozen(skill.tools) && Object.isFrozen(skill.arguments[0]), true);

const minimal = normalizeSkillManifest({ name: 'not-al', description: 'Kısa not alır.', prompt: 'Notu kaydet.' }, { source: 'builtin' });
assert.deepEqual(minimal.triggers, []);
assert.deepEqual(minimal.tools, []);
assert.deepEqual(minimal.arguments, []);
assert.equal(minimal.model, null);
assert.equal(minimal.execution, 'inline');

// Kaynak yalnız çağıran tarafından atanır; manifest kendi kaynağını iddia edemez.
rejects({}, /INVALID_SKILL_SOURCE/, { source: 'unknown' });
rejects({}, /INVALID_SKILL_SOURCE/, {});
rejects({ source: 'builtin' }, /INVALID_SKILL_FIELD/, { source: 'project' });
for (const field of ['env', 'apiKey', 'token', 'allowedTools', 'permissions', 'path']) {
  rejects({ [field]: 'x' }, /INVALID_SKILL_FIELD/);
}
for (const input of [null, [], 'skill', {}]) {
  assert.throws(() => normalizeSkillManifest(input, { source: 'user' }), /INVALID_SKILL_(MANIFEST|NAME)/);
}

for (const name of ['', 'A', 'x', 'has space', 'Üst', 'a'.repeat(65), '-lead']) rejects({ name }, /INVALID_SKILL_NAME/);
for (const description of ['', '   ', 'iki\nsatır', 'x'.repeat(SKILL_MANIFEST_LIMITS.maxDescriptionLength + 1)]) {
  rejects({ description }, /INVALID_SKILL_DESCRIPTION/);
}
for (const triggers of [
  'metin',
  ['özet', 'ÖZET'],
  ['bad\ttrigger'],
  Array.from({ length: SKILL_MANIFEST_LIMITS.maxTriggers + 1 }, (_, index) => `t${index}`)
]) {
  rejects({ triggers }, /INVALID_SKILL_TRIGGERS/);
}
for (const tools of [
  'task.read',
  ['task.read', 'task.read'],
  ['Task.Read'],
  Array.from({ length: SKILL_MANIFEST_LIMITS.maxTools + 1 }, (_, index) => `tool.t${index}`)
]) {
  rejects({ tools }, /INVALID_SKILL_TOOLS/);
}
// Skill hiçbir kaynakta secret okuma veya repo silme yetkisi talep edemez.
for (const tool of ['secret.read', 'repo.delete']) {
  rejects({ tools: [tool] }, /SKILL_TOOL_FORBIDDEN/, { source: 'builtin' });
}

rejects({ arguments: [{ name: 'a', kind: 'x' }] }, /INVALID_SKILL_ARGUMENT_FIELD/);
rejects({ arguments: [{ name: 'A' }] }, /INVALID_SKILL_ARGUMENT_NAME/);
rejects({ arguments: [{ name: 'a' }, { name: 'a' }] }, /INVALID_SKILL_ARGUMENT_NAME/);
rejects({ arguments: [{ name: 'a', type: 'object' }] }, /INVALID_SKILL_ARGUMENT_TYPE/);
rejects({ arguments: [{ name: 'a', required: 'yes' }] }, /INVALID_SKILL_ARGUMENT_REQUIRED/);
rejects({ model: 'Model Adı' }, /INVALID_SKILL_MODEL/);
rejects({ execution: 'bypass' }, /INVALID_SKILL_EXECUTION/);
for (const prompt of ['', 42, '\0', 'x'.repeat(SKILL_MANIFEST_LIMITS.maxPromptLength + 1)]) {
  rejects({ prompt }, /INVALID_SKILL_PROMPT/);
}
// Skill prompt'u credential taşıyamaz.
for (const prompt of [
  'Anahtarı process.env.NVIDIA_API_KEY üzerinden oku.',
  'Authorization: Bearer abc123def456ghi kullan.',
  'api_key: 1234567890 ile çağır.',
  'Şu anahtarı kullan: sk-abcdef0123456789abcd',
  '-----BEGIN RSA PRIVATE KEY-----'
]) {
  rejects({ prompt }, /SKILL_PROMPT_SECRET/);
}

assert.deepEqual(SKILL_SOURCES, ['builtin', 'user', 'project']);
assert.deepEqual(SKILL_EXECUTION_MODES, ['inline', 'fork']);
console.log('skill manifest tests passed');
