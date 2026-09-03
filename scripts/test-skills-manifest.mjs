import assert from 'node:assert/strict';
import { SKILL_MANIFEST_LIMITS, normalizeSkillManifest } from '../lib/skills-manifest.mjs';

const base = {
  name: 'Daily-Summary',
  description: 'Günlük görev özetini hazırlar.',
  triggers: ['Günlük özet', 'günlük özet', 'daily summary'],
  allowedTools: ['task.read', 'connector.gmail.read', 'task.read'],
  arguments: [{ name: 'day', required: true, description: 'Özetlenecek gün.' }],
  model: 'nvidia/llama-3.1-70b-instruct',
  execution: 'fork',
  prompt: 'Kullanıcının bugünkü görevlerini kısa maddeler hâlinde özetle.'
};
const user = (patch) => normalizeSkillManifest({ ...base, ...patch }, { source: 'user' });

const manifest = user({});
assert.equal(manifest.name, 'daily-summary');
assert.equal(manifest.source, 'user');
assert.equal(manifest.execution, 'fork');
assert.equal(manifest.model, 'nvidia/llama-3.1-70b-instruct');
assert.deepEqual(manifest.triggers, ['günlük özet', 'daily summary']);
assert.deepEqual(manifest.allowedTools, ['task.read', 'connector.gmail.read']);
assert.deepEqual(manifest.arguments, [{ name: 'day', required: true, description: 'Özetlenecek gün.' }]);
assert.equal(Object.isFrozen(manifest), true);
assert.equal(Object.isFrozen(manifest.triggers), true);
assert.equal(Object.isFrozen(manifest.allowedTools), true);

const minimal = normalizeSkillManifest({ name: 'notes', description: 'Not tutar.', prompt: 'Not tut.' }, { source: 'builtin' });
assert.equal(minimal.execution, 'inline');
assert.equal(minimal.model, null);
assert.deepEqual([minimal.triggers, minimal.allowedTools, minimal.arguments], [[], [], []]);

for (const source of [undefined, 'plugin', 'system', '']) {
  assert.throws(() => normalizeSkillManifest(base, { source }), /INVALID_SKILL_SOURCE/);
}
for (const input of [null, [], 'skill', 42]) {
  assert.throws(() => normalizeSkillManifest(input, { source: 'user' }), /INVALID_SKILL_MANIFEST|INVALID_SKILL_NAME/);
}
for (const field of ['systemPrompt', 'permissions', 'apiKey', 'toolPolicy', 'source']) {
  assert.throws(() => user({ [field]: 'x' }), /INVALID_SKILL_FIELD/);
}
for (const name of ['', ' ', '../escape', 'a', 'Skill Name', '-lead', 'x'.repeat(SKILL_MANIFEST_LIMITS.maxNameLength + 1)]) {
  assert.throws(() => user({ name }), /INVALID_SKILL_NAME/);
}
for (const description of ['', 'a\nb', 'x'.repeat(SKILL_MANIFEST_LIMITS.maxDescriptionLength + 1)]) {
  assert.throws(() => user({ description }), /INVALID_SKILL_DESCRIPTION/);
}
for (const prompt of ['', '   ', 42, 'x'.repeat(SKILL_MANIFEST_LIMITS.maxPromptLength + 1)]) {
  assert.throws(() => user({ prompt }), /INVALID_SKILL_PROMPT/);
}
assert.throws(() => user({ triggers: Array.from({ length: 13 }, (_, i) => `t${i}`) }), /INVALID_SKILL_TRIGGERS/);
assert.throws(() => user({ triggers: [''] }), /INVALID_SKILL_TRIGGER/);
assert.throws(() => user({ allowedTools: 'task.read' }), /INVALID_SKILL_TOOLS/);
assert.throws(() => user({ allowedTools: ['Repo Merge'] }), /INVALID_SKILL_TOOL/);
assert.throws(() => user({ arguments: [{ name: 'a', extra: 1 }] }), /INVALID_SKILL_ARGUMENT_FIELD/);
assert.throws(() => user({ arguments: [{ name: 'a' }, { name: 'a' }] }), /INVALID_SKILL_ARGUMENT/);
assert.throws(() => user({ execution: 'bypass' }), /INVALID_SKILL_EXECUTION/);
assert.throws(() => user({ model: 'model name' }), /INVALID_SKILL_MODEL/);

// Proje kaynaklı skill kendi modelini seçemez ve izole fork yürütmesi açamaz.
const project = (patch) => normalizeSkillManifest({ ...base, ...patch }, { source: 'project' });
assert.throws(() => project({ execution: 'inline' }), /SKILL_PROJECT_MODEL_FORBIDDEN/);
assert.throws(() => project({ model: undefined }), /SKILL_PROJECT_FORK_FORBIDDEN/);
const projectSkill = project({ model: undefined, execution: 'inline' });
assert.deepEqual([projectSkill.source, projectSkill.execution, projectSkill.model], ['project', 'inline', null]);

// Skill prompt'u veya açıklaması credential taşıyamaz.
for (const prompt of [
  'NVIDIA_API_KEY=nvapi-1234567890abcdef kullan.',
  'Authorization: Bearer abcdef1234567890 gönder.',
  'Anahtar: sk-ABCDEFGHIJKLMNOP',
  '-----BEGIN RSA PRIVATE KEY-----',
  'process.env.GITHUB_TOKEN değerini yaz.',
  'token = ghp_ABCDEFGHIJKLMNOPQRST'
]) {
  assert.throws(() => user({ prompt }), /SKILL_PROMPT_SECRET_FORBIDDEN/);
}
assert.throws(() => user({ description: 'api_key: nvapi-secret-value' }), /SKILL_PROMPT_SECRET_FORBIDDEN/);

console.log('skills manifest tests passed');
