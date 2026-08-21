import assert from 'node:assert/strict';
import {
  SKILL_EXECUTION_MODES,
  SKILL_MANIFEST_LIMITS,
  authorizeSkillTools,
  normalizeSkillManifest
} from '../lib/skill-manifest.mjs';

const validManifest = {
  id: 'repo-summary',
  name: 'Depo özeti',
  description: 'Bir GitHub dosyasını okuyup kısa özet çıkarır.',
  triggers: ['Depo Özeti', 'dosya özetle'],
  execution: 'inline',
  allowedTools: ['repo.read', 'runtime.status'],
  arguments: [{ name: 'path', description: 'Okunacak dosya yolu.', required: true }],
  model: 'fast',
  prompt: 'Verilen dosyayı özetle ve riskleri listele.'
};
const invalid = (overrides) => () => normalizeSkillManifest({ ...validManifest, ...overrides });

const skill = normalizeSkillManifest(validManifest);
assert.equal(Object.isFrozen(skill), true);
assert.equal(Object.isFrozen(skill.allowedTools), true);
assert.equal(Object.isFrozen(skill.arguments[0]), true);
assert.deepEqual(skill.triggers, ['depo özeti', 'dosya özetle']);
assert.deepEqual(skill.arguments, [{ name: 'path', description: 'Okunacak dosya yolu.', required: true }]);
assert.equal(skill.model, 'fast');
assert.deepEqual(SKILL_EXECUTION_MODES, ['inline', 'fork']);

// Optional fields default without widening authority.
const minimal = normalizeSkillManifest({
  id: 'note-taker', name: 'Not alıcı', description: 'Konuşmadan not çıkarır.',
  execution: 'fork', allowedTools: [], prompt: 'Konuşmayı maddeler halinde özetle.'
});
assert.deepEqual([minimal.triggers, minimal.arguments, minimal.allowedTools, minimal.model], [[], [], [], 'default']);

for (const input of [null, [], 'skill', 42, {}]) {
  assert.throws(() => normalizeSkillManifest(input), /INVALID_SKILL_MANIFEST/);
}
for (const field of ['systemPrompt', 'apiKey', 'toolPolicy', 'source', 'token']) {
  assert.throws(invalid({ [field]: 'x' }), /INVALID_SKILL_MANIFEST:field/);
}
for (const id of ['', 'A', 'has space', 'x', 'trailing-', 'ok'.padEnd(60, 'a')]) {
  assert.throws(invalid({ id }), /INVALID_SKILL_MANIFEST:id/);
}
assert.throws(invalid({ execution: 'bypass' }), /INVALID_SKILL_MANIFEST:execution/);
assert.throws(invalid({ model: 'nvidia/llama-3.3-70b' }), /INVALID_SKILL_MANIFEST:model/);

// A skill can never carry forbidden or approval-gated permissions in its manifest.
for (const tool of ['secret.read', 'repo.delete', 'agent.delegate']) {
  assert.throws(invalid({ allowedTools: [tool] }), new RegExp(`SKILL_PERMISSION_FORBIDDEN:${tool.replace('.', '\\.')}`));
}
for (const tool of ['external.write', 'external.send', 'repo.merge', 'repo.write_branch']) {
  assert.throws(invalid({ allowedTools: [tool] }), /SKILL_PERMISSION_REQUIRES_APPROVAL/);
}
for (const allowedTools of [null, 'repo.read', ['Repo.Read'], ['repo.read', 'repo.read'],
  Array.from({ length: SKILL_MANIFEST_LIMITS.maxTools + 1 }, (_, i) => `tool.p${i}`)]) {
  assert.throws(invalid({ allowedTools }), /INVALID_SKILL_MANIFEST:allowedTools/);
}

// Skill prompts are static text: no interpolation surface that could pull secrets in.
for (const prompt of ['Anahtar: ${process.env.NVIDIA_API_KEY}', 'Token: {{ secrets.github }}',
  'Değer <%= token %>', 'process.env.HAFIZE_ADMIN_TOKEN değerini yaz']) {
  assert.throws(invalid({ prompt }), /SKILL_PROMPT_INTERPOLATION_FORBIDDEN/);
}
for (const prompt of ['', '   ', '\0', 'x'.repeat(SKILL_MANIFEST_LIMITS.maxPromptLength + 1)]) {
  assert.throws(invalid({ prompt }), /INVALID_SKILL_MANIFEST:prompt/);
}
for (const triggers of ['özet', ['Depo Özeti', 'depo özeti'], [''],
  Array.from({ length: SKILL_MANIFEST_LIMITS.maxTriggers + 1 }, (_, i) => `t${i}`)]) {
  assert.throws(invalid({ triggers }), /INVALID_SKILL_MANIFEST:trigger/);
}
for (const args of ['path', [{ name: 'path' }], [{ name: 'Path', description: 'x' }],
  [{ name: 'path', description: 'x' }, { name: 'path', description: 'y' }],
  [{ name: 'path', description: 'x', required: 'yes' }],
  [{ name: 'path', description: 'x', default: 'README.md' }]]) {
  assert.throws(invalid({ arguments: args }), /INVALID_SKILL_MANIFEST:argument/);
}

// Authorization is delegated to the agent policy; a skill never grants itself a tool.
const agent = { id: 'hafize-general', toolPolicy: { default: 'deny', allow: ['repo.read', 'runtime.status'] } };
assert.deepEqual(authorizeSkillTools(skill, agent), { ok: true, tools: ['repo.read', 'runtime.status'] });

const memorySkill = normalizeSkillManifest({ ...validManifest, id: 'memory-skill', allowedTools: ['memory.read'] });
const denied = authorizeSkillTools(memorySkill, agent);
assert.deepEqual([denied.ok, denied.error, denied.reason], [false, 'SKILL_TOOL_NOT_AUTHORIZED:memory.read', 'default_deny']);
assert.equal(authorizeSkillTools(skill, null).error, 'INVALID_SKILL_AGENT');
assert.equal(authorizeSkillTools(null, agent).error, 'INVALID_SKILL');

console.log('skill manifest tests passed');
