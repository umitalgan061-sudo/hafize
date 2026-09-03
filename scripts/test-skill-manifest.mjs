import assert from 'node:assert/strict';
import { SKILL_MANIFEST_LIMITS, normalizeSkillManifest } from '../lib/skill-manifest.mjs';

const base = {
  name: 'pr-ozeti',
  description: 'Açık pull request için kısa özet çıkarır.',
  source: 'builtin',
  triggers: ['PR özeti', 'pull request özeti'],
  allowedTools: ['github.read', 'task.read'],
  arguments: [{ name: 'prNumber', required: true, description: 'PR numarası' }],
  prompt: '{{prNumber}} numaralı PR için risk ve test durumunu özetle.'
};

const skill = normalizeSkillManifest(base);
assert.equal(skill.name, 'pr-ozeti');
assert.equal(skill.source, 'builtin');
assert.equal(skill.execution, 'inline');
assert.equal(skill.model, null);
assert.equal(skill.projectScope, null);
assert.deepEqual([...skill.triggers], ['pr özeti', 'pull request özeti']);
assert.deepEqual([...skill.allowedTools], ['github.read', 'task.read']);
assert.equal(skill.arguments[0].required, true);
assert.equal(Object.isFrozen(skill), true);
assert.throws(() => skill.allowedTools.push('external.write'), TypeError);

assert.equal(normalizeSkillManifest({ ...base, execution: 'fork', model: 'nvidia/llama-3.3' }).execution, 'fork');

// Strict doğrulama: bilinmeyen alan, bozuk değer, yetki yükseltmesi ve credential sızması reddedilir.
for (const [overrides, pattern] of [
  [{ extra: true }, /INVALID_SKILL_MANIFEST_FIELD/],
  [{ name: 'Büyük Ad' }, /INVALID_SKILL_NAME/],
  [{ source: 'plugin' }, /INVALID_SKILL_SOURCE/],
  [{ execution: 'bypass' }, /INVALID_SKILL_EXECUTION/],
  [{ model: 'DROP TABLE' }, /INVALID_SKILL_MODEL/],
  [{ description: '' }, /INVALID_SKILL_DESCRIPTION/],
  [{ description: 'x'.repeat(SKILL_MANIFEST_LIMITS.maxDescriptionLength + 1) }, /INVALID_SKILL_DESCRIPTION/],
  [{ triggers: ['aynı', 'aynı'] }, /INVALID_SKILL_TRIGGER/],
  [{ triggers: 'PR' }, /INVALID_SKILL_TRIGGERS/],
  [{ allowedTools: ['secret.read'] }, /SKILL_TOOL_FORBIDDEN/],
  [{ allowedTools: ['repo.delete'] }, /SKILL_TOOL_FORBIDDEN/],
  [{ allowedTools: ['Github.Read'] }, /INVALID_SKILL_TOOL/],
  [{ allowedTools: ['task.read', 'task.read'] }, /INVALID_SKILL_TOOL/],
  [{ arguments: [{ name: 'apiKey' }], prompt: 'sabit metin' }, /SKILL_ARGUMENT_SECRET_FORBIDDEN/],
  [{ arguments: [{ name: 'sessionId' }], prompt: 'sabit metin' }, /SKILL_ARGUMENT_SECRET_FORBIDDEN/],
  [{ arguments: [{ name: 'x', extra: 1 }] }, /INVALID_SKILL_ARGUMENT_FIELD/],
  [{ arguments: [{ name: 'prNumber', required: 'yes' }] }, /INVALID_SKILL_ARGUMENT/],
  [{ arguments: [], prompt: 'Token: process.env.NVIDIA_API_KEY' }, /SKILL_PROMPT_SECRET_FORBIDDEN/],
  [{ arguments: [], prompt: 'Anahtar: {{ secretValue }}' }, /SKILL_PROMPT_SECRET_FORBIDDEN/],
  [{ prompt: '{{bilinmeyen}}' }, /INVALID_SKILL_PROMPT_PLACEHOLDER/],
  [{ prompt: '   ' }, /INVALID_SKILL_PROMPT/]
]) {
  assert.throws(() => normalizeSkillManifest({ ...base, ...overrides }), pattern);
}
assert.throws(() => normalizeSkillManifest(null), /INVALID_SKILL_MANIFEST/);

// Project skill yalnız açık kapsamla tanımlanır.
assert.throws(() => normalizeSkillManifest({ ...base, source: 'project' }), /INVALID_SKILL_PROJECT_SCOPE/);
assert.throws(() => normalizeSkillManifest({ ...base, projectScope: 'repo:hafize' }), /INVALID_SKILL_PROJECT_SCOPE/);
assert.equal(
  normalizeSkillManifest({ ...base, source: 'project', projectScope: 'repo:umitalgan061-sudo/hafize' }).projectScope,
  'repo:umitalgan061-sudo/hafize'
);

console.log('skill manifest tests passed');
