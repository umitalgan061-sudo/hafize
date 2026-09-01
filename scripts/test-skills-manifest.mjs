import assert from 'node:assert/strict';
import { loadAgentRegistry, resolveAgent } from '../lib/agent-runtime.mjs';
import {
  SKILL_EXECUTIONS,
  SKILL_SOURCES,
  parseSkillManifest,
  resolveSkillTools
} from '../lib/skills-manifest.mjs';

const base = {
  id: 'repo-triage',
  name: 'Repo Triage',
  description: 'Depo dosyalarını okuyup kısa bir durum özeti çıkarır.',
  source: 'builtin',
  triggers: ['depoyu incele', 'repo durumu'],
  allowedTools: ['repo.read', 'trace.write'],
  arguments: [{ name: 'path', description: 'İncelenecek dosya yolu.', required: true }],
  prompt: 'Depodaki dosyaları oku ve bulguları maddeler hâlinde özetle.'
};

const skill = parseSkillManifest(base);
assert.equal(skill.id, 'repo-triage');
assert.equal(skill.source, 'builtin');
assert.equal(skill.execution, 'inline');
assert.deepEqual([...skill.allowedTools], ['repo.read', 'trace.write']);
assert.equal(skill.arguments[0].required, true);
assert.equal(Object.isFrozen(skill), true);
assert.equal(Object.isFrozen(skill.triggers), true);
assert.equal('model' in skill, false);
assert.equal('projectScope' in skill, false);
assert.deepEqual([...SKILL_SOURCES], ['builtin', 'user', 'project']);
assert.deepEqual([...SKILL_EXECUTIONS], ['inline', 'fork']);

const forked = parseSkillManifest({ ...base, execution: 'fork', model: 'nvidia/llama-3.3-70b-instruct' });
assert.equal(forked.execution, 'fork');
assert.equal(forked.model, 'nvidia/llama-3.3-70b-instruct');

const project = parseSkillManifest({ ...base, source: 'project', projectScope: 'hafize/docs' });
assert.equal(project.projectScope, 'hafize/docs');

// Skill kendi yetkisini yükseltemez: hiç verilmeyen ve onay gerektiren izinler reddedilir.
for (const permission of ['secret.read', 'repo.delete', 'repo.merge']) {
  assert.throws(() => parseSkillManifest({ ...base, allowedTools: [permission] }), /allowedTools\.forbidden/);
}
for (const permission of ['external.write', 'external.send', 'repo.write_branch']) {
  assert.throws(() => parseSkillManifest({ ...base, allowedTools: [permission] }), /allowedTools\.approvalRequired/);
}

// Prompt ve açıklamalar credential taşıyamaz.
assert.throws(() => parseSkillManifest({ ...base, prompt: 'Anahtar: nvapi-abcdef1234567890' }), /prompt\.secret/);
assert.throws(() => parseSkillManifest({ ...base, prompt: 'client_secret = 123' }), /prompt\.secret/);
assert.throws(
  () => parseSkillManifest({ ...base, description: '-----BEGIN RSA PRIVATE KEY-----' }),
  /description\.secret/
);

// Strict manifest: bilinmeyen alan, geçersiz değer ve eksik zorunlu alanlar reddedilir.
assert.throws(() => parseSkillManifest({ ...base, tools: ['repo.read'] }), /manifest\.tools/);
assert.throws(() => parseSkillManifest({ ...base, id: 'Repo Triage' }), /INVALID_SKILL_MANIFEST:id/);
assert.throws(() => parseSkillManifest({ ...base, source: 'remote' }), /INVALID_SKILL_MANIFEST:source/);
assert.throws(() => parseSkillManifest({ ...base, execution: 'bypass' }), /INVALID_SKILL_MANIFEST:execution/);
assert.throws(() => parseSkillManifest({ ...base, triggers: [] }), /INVALID_SKILL_MANIFEST:triggers/);
assert.throws(() => parseSkillManifest({ ...base, triggers: ['a', 'a'] }), /triggers\.duplicate/);
assert.throws(() => parseSkillManifest({ ...base, prompt: '' }), /INVALID_SKILL_MANIFEST:prompt/);
assert.throws(() => parseSkillManifest({ ...base, source: 'project' }), /INVALID_SKILL_MANIFEST:projectScope/);
assert.throws(
  () => parseSkillManifest({ ...base, source: 'project', projectScope: '../etc' }),
  /INVALID_SKILL_MANIFEST:projectScope/
);
assert.throws(() => parseSkillManifest({ ...base, projectScope: 'hafize' }), /projectScope\.unexpected/);
assert.throws(() => parseSkillManifest(null), /INVALID_SKILL_MANIFEST:manifest/);
assert.throws(() => parseSkillManifest([base]), /INVALID_SKILL_MANIFEST:manifest/);

// Ajan politikası son sözü söyler: skill yalnız ajanın zaten sahip olduğu araçları görür.
const registry = await loadAgentRegistry();
const reviewer = resolveAgent(registry, 'agency-code-reviewer');
const reviewSkill = parseSkillManifest({ ...base, allowedTools: ['repo.read', 'pr.comment', 'connector.gmail.read'] });
const resolved = resolveSkillTools(reviewSkill, reviewer);
assert.deepEqual([...resolved.granted], ['repo.read']);
assert.deepEqual(
  resolved.rejected.map(({ permission, reason }) => `${permission}:${reason}`),
  ['pr.comment:approval_required', 'connector.gmail.read:default_deny']
);
assert.equal(Object.isFrozen(resolved.granted), true);
assert.throws(() => resolveSkillTools(null, reviewer), /INVALID_SKILL_MANIFEST:skill/);
assert.throws(() => resolveSkillTools(reviewSkill, null), /INVALID_SKILL_MANIFEST:agent/);

console.log('skills manifest tests passed');
