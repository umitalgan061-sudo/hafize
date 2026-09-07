import assert from 'node:assert/strict';
import {
  SKILL_MANIFEST_LIMITS,
  containsSecretMaterial,
  normalizeSkillManifest
} from '../lib/skills-manifest.mjs';

const base = {
  name: 'repo-triage',
  description: 'Depo sorunlarını salt-okunur olarak sınıflandırır.',
  triggers: ['Repo Triage', 'issue triage'],
  allowedTools: ['repo.read', 'trace.write'],
  arguments: [{ name: 'repo', required: true, description: 'Hedef depo.' }, { name: 'label' }],
  prompt: 'Depo sorunlarını incele ve önceliklendir.'
};

const manifest = normalizeSkillManifest(base);
assert.equal(manifest.name, 'repo-triage');
assert.equal(manifest.execution, 'inline');
assert.equal(manifest.model, '');
assert.deepEqual([...manifest.triggers], ['repo triage', 'issue triage']);
assert.deepEqual(manifest.arguments.map((item) => item.required), [true, false]);
assert.equal(Object.isFrozen(manifest), true);
assert.throws(() => { manifest.allowedTools.push('secret.read'); });

// Strict manifest: unknown fields, malformed values and credential material are rejected.
for (const [patch, pattern] of [
  [{ source: 'builtin' }, /INVALID_SKILL_FIELD/],
  [{ name: 'Repo Triage' }, /INVALID_SKILL_NAME/],
  [{ description: '' }, /INVALID_SKILL_DESCRIPTION/],
  [{ triggers: ['a', 'a'] }, /INVALID_SKILL_TRIGGERS/],
  [{ allowedTools: [] }, /INVALID_SKILL_TOOLS/],
  [{ allowedTools: ['repo.read', 'repo.read'] }, /INVALID_SKILL_TOOLS/],
  [{ arguments: [{ name: 'repo', extra: 1 }] }, /INVALID_SKILL_ARGUMENT_FIELD/],
  [{ arguments: [{ name: 'Repo' }] }, /INVALID_SKILL_ARGUMENTS/],
  [{ model: 'nvidia/model key' }, /INVALID_SKILL_MODEL/],
  [{ prompt: '' }, /INVALID_SKILL_PROMPT/],
  [{ execution: 'bypass' }, /INVALID_SKILL_EXECUTION/],
  [{ allowedTools: ['secret.read'] }, /FORBIDDEN_SKILL_TOOL:secret.read/],
  [{ allowedTools: ['repo.delete'] }, /FORBIDDEN_SKILL_TOOL:repo.delete/],
  [{ prompt: 'Şu anahtarı kullan: nvapi-0123456789abcdefghij' }, /SKILL_PROMPT_SECRET_MATERIAL/],
  [{ prompt: 'client_secret = 9f8a7b6c5d4e' }, /SKILL_PROMPT_SECRET_MATERIAL/]
]) {
  assert.throws(() => normalizeSkillManifest({ ...base, ...patch }), pattern);
}
assert.throws(() => normalizeSkillManifest(null), /INVALID_SKILL_MANIFEST/);

// Approval-gated tools are only allowed in isolated fork execution.
for (const tool of SKILL_MANIFEST_LIMITS.approvalOnlyTools) {
  assert.throws(
    () => normalizeSkillManifest({ ...base, allowedTools: [tool] }),
    /INVALID_SKILL_EXECUTION:approval_requires_fork/
  );
  assert.equal(normalizeSkillManifest({ ...base, allowedTools: [tool], execution: 'fork' }).execution, 'fork');
}

assert.equal(containsSecretMaterial('api_key: abc123'), true);
assert.equal(containsSecretMaterial('Authorization: Bearer abc.def'), true);
assert.equal(containsSecretMaterial('Depo sorunlarını incele.'), false);

console.log('skills manifest tests passed');
