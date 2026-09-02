import assert from 'node:assert/strict';
import { SKILL_LIMITS, SKILL_SOURCES, normalizeSkillManifest } from '../lib/skill-manifest.mjs';

const validInput = {
  id: 'daily-brief',
  name: 'Günlük özet',
  description: 'Kullanıcının gününü kısa ve okunabilir bir özet hâline getirir.',
  triggers: ['Günlük özet', 'brief'],
  allowedTools: ['runtime.status', 'connector.gmail.read'],
  arguments: [{ name: 'gun', description: 'Özetlenecek gün.', required: true }],
  model: 'nvidia/llama-3.3-70b-instruct',
  execution: 'inline',
  prompt: 'Kullanıcının gününü özetle ve yalnızca izin verilen araçları kullan.'
};
const rejects = (overrides, pattern, options = { source: 'builtin' }) =>
  assert.throws(() => normalizeSkillManifest({ ...validInput, ...overrides }, options), pattern);

const manifest = normalizeSkillManifest(validInput, { source: 'builtin' });
assert.deepEqual(manifest, {
  id: 'daily-brief',
  source: 'builtin',
  name: 'Günlük özet',
  description: 'Kullanıcının gününü kısa ve okunabilir bir özet hâline getirir.',
  triggers: ['günlük özet', 'brief'],
  allowedTools: ['runtime.status', 'connector.gmail.read'],
  arguments: [{ name: 'gun', description: 'Özetlenecek gün.', required: true }],
  model: 'nvidia/llama-3.3-70b-instruct',
  execution: 'inline',
  prompt: 'Kullanıcının gününü özetle ve yalnızca izin verilen araçları kullan.'
});
assert.equal(Object.isFrozen(manifest) && Object.isFrozen(manifest.triggers) && Object.isFrozen(manifest.allowedTools), true);
assert.equal(Object.isFrozen(manifest.arguments) && Object.isFrozen(manifest.arguments[0]), true);

// Varsayılanlar: tetikleyici/araç/argüman yoksa boş, execution inline, model tercihi yok.
const minimal = normalizeSkillManifest({ id: 'kisa-not', name: 'Kısa not', description: 'Not alır.', prompt: 'Not al.' }, { source: 'user' });
assert.deepEqual([minimal.triggers, minimal.allowedTools, minimal.arguments, minimal.execution, minimal.model], [[], [], [], 'inline', null]);

// Kaynak sözleşmesi: bilinmeyen kaynak reddedilir, project yalnız açık izinle yüklenir.
assert.deepEqual(SKILL_SOURCES, ['builtin', 'user', 'project']);
rejects({}, /INVALID_SKILL_SOURCE/, { source: 'plugin' });
rejects({}, /INVALID_SKILL_SOURCE/, {});
rejects({}, /SKILL_PROJECT_SCOPE_NOT_ALLOWED/, { source: 'project' });
assert.equal(normalizeSkillManifest(validInput, { source: 'project', projectScopeAllowed: true }).source, 'project');

// Strict manifest: bilinmeyen alan veya kaçak yetki alanı kabul edilmez.
for (const field of ['systemPrompt', 'permissions', 'env', 'credentials', 'toolPolicy']) rejects({ [field]: 'x' }, /INVALID_SKILL_FIELD/);
for (const input of [null, [], 'skill']) assert.throws(() => normalizeSkillManifest(input, { source: 'builtin' }), /INVALID_SKILL_MANIFEST/);
for (const id of ['Daily Brief', 'a', '1brief', 'x'.repeat(65), 42]) rejects({ id }, /INVALID_SKILL_ID/);
for (const model of ['model with space', '', 'x'.repeat(81)]) rejects({ model }, /INVALID_SKILL_MODEL/);
for (const name of ['', '   ', 'x'.repeat(SKILL_LIMITS.maxNameLength + 1)]) rejects({ name }, /INVALID_SKILL_NAME/);
rejects({ description: '' }, /INVALID_SKILL_DESCRIPTION/);

// Yetki yükseltme: yasak ve onay gerektiren izinler manifest'ten alınamaz.
for (const tool of ['secret.read', 'repo.delete']) rejects({ allowedTools: [tool] }, /SKILL_FORBIDDEN_TOOL/);
for (const tool of ['external.write', 'external.send', 'repo.merge', 'repo.write_branch']) rejects({ allowedTools: [tool] }, /SKILL_APPROVAL_ONLY_TOOL/);
for (const tools of [['runtime.status', 'runtime.status'], ['Runtime.Status'], [''], [42]]) rejects({ allowedTools: tools }, /INVALID_SKILL_ALLOWED_TOOL/);
rejects({ allowedTools: Array.from({ length: SKILL_LIMITS.maxAllowedTools + 1 }, (_, i) => `tool.${i}`) }, /INVALID_SKILL_ALLOWED_TOOLS/);

// Execution sözleşmesi yalnız inline/fork.
assert.equal(normalizeSkillManifest({ ...validInput, execution: 'fork' }, { source: 'builtin' }).execution, 'fork');
for (const execution of ['bypass', 'shell', '', 3]) rejects({ execution }, /INVALID_SKILL_EXECUTION/);

// Prompt sözleşmesi: secret/credential taşıyan prompt reddedilir.
for (const prompt of [
  'api_key: nvapi-0123456789abcdefghij',
  'Token: ghp_0123456789abcdefghij0123456789abcdef',
  'client_secret=abc123',
  '-----BEGIN RSA PRIVATE KEY-----',
  'Anahtar sk-0123456789abcdefghij kullan.'
]) rejects({ prompt }, /SKILL_PROMPT_SECRET_SUSPECTED/);
for (const prompt of ['', '   ', '\0', 'x'.repeat(SKILL_LIMITS.maxPromptLength + 1), 42]) rejects({ prompt }, /INVALID_SKILL_PROMPT/);

// Argüman ve tetikleyici sınırları.
for (const args of [
  [{ name: 'gun', description: 'x' }, { name: 'gun', description: 'y' }],
  [{ name: 'Gun', description: 'x' }],
  [{ name: 'gun', description: 'x', required: 'yes' }],
  [{ name: 'gun' }],
  ['gun']
]) rejects({ arguments: args }, /INVALID_SKILL_ARGUMENT/);
rejects({ arguments: [{ name: 'gun', description: 'x', cmd: 'rm' }] }, /INVALID_SKILL_ARGUMENT_FIELD/);
for (const triggers of [['ozet', 'Ozet'], [''], ['x'.repeat(SKILL_LIMITS.maxTriggerLength + 1)], ['çok\nsatır']]) rejects({ triggers }, /INVALID_SKILL_TRIGGER/);
rejects({ triggers: Array.from({ length: SKILL_LIMITS.maxTriggers + 1 }, (_, i) => `t${i}`) }, /INVALID_SKILL_TRIGGERS/);

console.log('skill manifest contract tests passed');
