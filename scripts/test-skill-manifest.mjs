import assert from 'node:assert/strict';
import { normalizeSkillManifest, SKILL_MANIFEST_CONTRACT } from '../lib/skill-manifest.mjs';

const options = { source: 'builtin', grantedTools: ['repo.read', 'runtime.status', 'trace.write'] };

const validInput = {
  name: 'repo-summary',
  description: 'Depo dosyalarını özetler.',
  triggers: ['Depo özeti', 'repo summary'],
  allowedTools: ['repo.read'],
  arguments: [{ name: 'path', description: 'Okunacak yol.', required: true }],
  model: 'nvidia/llama-3.3-70b-instruct',
  prompt: 'Verilen yolu oku ve kısa bir özet üret.'
};

const rejects = (patch, pattern, opts = options) =>
  assert.throws(() => normalizeSkillManifest({ ...validInput, ...patch }, opts), pattern);

const skill = normalizeSkillManifest(validInput, options);
assert.deepEqual(skill, {
  name: 'repo-summary',
  source: 'builtin',
  description: 'Depo dosyalarını özetler.',
  triggers: ['depo özeti', 'repo summary'],
  allowedTools: ['repo.read'],
  arguments: [{ name: 'path', description: 'Okunacak yol.', required: true }],
  model: 'nvidia/llama-3.3-70b-instruct',
  executionContext: 'inline',
  forkAgentId: null,
  prompt: 'Verilen yolu oku ve kısa bir özet üret.'
});
assert.equal(Object.isFrozen(skill), true);
assert.equal(Object.isFrozen(skill.allowedTools), true);
assert.equal(Object.isFrozen(skill.arguments[0]), true);

// Varsayılanlar: opsiyonel alanlar boş kalabilir, executionContext inline'dır.
const minimal = normalizeSkillManifest({ name: 'kisa', description: 'Kısa.', prompt: 'Yap.' }, options);
assert.deepEqual(minimal.triggers, []);
assert.deepEqual(minimal.allowedTools, []);
assert.deepEqual(minimal.arguments, []);
assert.equal(minimal.model, null);
assert.equal(minimal.executionContext, 'inline');

// Kaynak sözleşmesi: project skill yalnız açık izinle yüklenir, kaynak model girdisinden gelmez.
rejects({}, /SKILL_PROJECT_SOURCE_NOT_ALLOWED/, { ...options, source: 'project' });
const projectOptions = { ...options, source: 'project', projectScopeAllowed: true };
assert.equal(normalizeSkillManifest(validInput, projectOptions).source, 'project');
for (const source of [undefined, 'plugin', 'BUILTIN', '']) rejects({}, /INVALID_SKILL_SOURCE/, { ...options, source });

// Yetki yükseltme: agent'ın vermediği bir permission bildirilemez.
for (const tool of ['secret.read', 'external.send', 'repo.write_branch']) {
  rejects({ allowedTools: [tool] }, /SKILL_TOOL_ESCALATION/);
}
rejects({ allowedTools: ['repo.read', 'repo.read'] }, /INVALID_SKILL_ALLOWED_TOOL/);
rejects({ allowedTools: ['Repo.Read'] }, /INVALID_SKILL_ALLOWED_TOOL/);
const tooManyTools = Array.from({ length: SKILL_MANIFEST_CONTRACT.maxTools + 1 }, () => 'repo.read');
rejects({ allowedTools: tooManyTools }, /INVALID_SKILL_ALLOWED_TOOLS/);

// Prompt secret hijyeni.
for (const prompt of [
  'Anahtarı kullan: sk-abcdefghijklmnopqrstuvwx',
  'token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345',
  'nvapi-0123456789abcdefghij ile çağır',
  'AWS anahtarı AKIAIOSFODNN7EXAMPLE kullan',
  '-----BEGIN RSA PRIVATE KEY-----',
  'api_key = 0123456789abcdef',
  'client_secret: super-secret-value'
]) {
  rejects({ prompt }, /SKILL_PROMPT_SECRET_DETECTED/);
}
for (const prompt of ['', '   ', '\0', 'x'.repeat(SKILL_MANIFEST_CONTRACT.maxPromptLength + 1)]) {
  rejects({ prompt }, /INVALID_SKILL_PROMPT/);
}

// Bilinmeyen alan reddi: manifest kendi yürütme bağlamını veya onayını genişletemez.
for (const field of ['env', 'secrets', 'credentials', 'command', 'cwd', 'source', 'approvalGranted']) {
  rejects({ [field]: 'x' }, /INVALID_SKILL_FIELD/);
}

// İsim, açıklama, trigger, argüman ve model sözleşmeleri.
for (const name of ['', 'A', 'Repo-Summary', 'repo summary', '1repo', 'x'.repeat(65)]) {
  rejects({ name }, /INVALID_SKILL_NAME/);
}
for (const description of ['', 'x'.repeat(SKILL_MANIFEST_CONTRACT.maxDescriptionLength + 1)]) {
  rejects({ description }, /INVALID_SKILL_DESCRIPTION/);
}
rejects({ triggers: ['Ozet', 'ozet'] }, /INVALID_SKILL_TRIGGER/);
const tooManyTriggers = Array.from({ length: SKILL_MANIFEST_CONTRACT.maxTriggers + 1 }, (_, i) => `t${i}`);
rejects({ triggers: tooManyTriggers }, /INVALID_SKILL_TRIGGERS/);
for (const args of [
  [{ name: 'path' }],
  [{ name: 'Path', description: 'x' }],
  [{ name: 'path', description: 'x', required: 'yes' }],
  [{ name: 'path', description: 'x', type: 'string' }],
  [{ name: 'path', description: 'x' }, { name: 'path', description: 'y' }]
]) {
  rejects({ arguments: args }, /INVALID_SKILL_ARGUMENT/);
}
for (const model of ['x'.repeat(81), 'model with space', '/leading-slash']) rejects({ model }, /INVALID_SKILL_MODEL/);

// inline/fork ayrımı: fork hedefi zorunlu, inline'da forkAgentId verilemez.
rejects({ forkAgentId: 'agency-code-reviewer' }, /INVALID_SKILL_FORK_AGENT/);
rejects({ executionContext: 'fork' }, /INVALID_SKILL_FORK_AGENT/);
rejects({ executionContext: 'shell' }, /INVALID_SKILL_EXECUTION_CONTEXT/);
const forked = normalizeSkillManifest({ ...validInput, executionContext: 'fork', forkAgentId: 'agency-code-reviewer' }, options);
assert.equal(forked.executionContext, 'fork');
assert.equal(forked.forkAgentId, 'agency-code-reviewer');

for (const input of [null, [], 'skill', { name: 'a-b' }]) {
  assert.throws(() => normalizeSkillManifest(input, options), /INVALID_SKILL/);
}

console.log('skill manifest tests passed');
