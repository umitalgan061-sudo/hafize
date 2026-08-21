import assert from 'node:assert/strict';
import {
  SKILLS_MANIFEST_CONTRACT,
  authorizeSkillForAgent,
  createSkillRegistry,
  normalizeSkillManifest
} from '../lib/skills-manifest.mjs';

const base = {
  name: 'gmail-triage',
  description: 'Gelen kutusunu okur ve öncelik sırası çıkarır.',
  triggers: ['gmail özeti', 'gelen kutusu'],
  allowedTools: ['connector.gmail.read'],
  arguments: [{ name: 'limit', type: 'number', required: true, description: 'Okunacak konu sayısı.' }],
  model: 'nvidia/llama-3.3-70b-instruct',
  executionContext: 'inline',
  prompt: 'Kullanıcının gelen kutusunu özetle ve acil olanları listele.'
};

const builtin = normalizeSkillManifest(base, { source: 'builtin' });
assert.equal(builtin.name, 'gmail-triage');
assert.equal(builtin.source, 'builtin');
assert.equal(builtin.projectScope, null);
assert.equal(builtin.executionContext, 'inline');
assert.deepEqual(builtin.allowedTools, ['connector.gmail.read']);
assert.equal(builtin.arguments[0].required, true);
assert.throws(() => { builtin.allowedTools.push('secret.read'); }, TypeError);

const defaults = normalizeSkillManifest({ name: 'notes', description: 'Not alır.', prompt: 'Not al.' }, { source: 'user' });
assert.equal(defaults.executionContext, 'inline');
assert.equal(defaults.model, null);
assert.deepEqual(defaults.allowedTools, []);
assert.deepEqual(defaults.arguments, []);

// Yetki yükseltme ve secret sızıntısı reddedilir.
assert.throws(() => normalizeSkillManifest({ ...base, allowedTools: ['secret.read'] }, { source: 'builtin' }),
  /allowedTools.forbidden:secret.read/);
assert.throws(() => normalizeSkillManifest({ ...base, allowedTools: ['external.send'] }, { source: 'builtin' }),
  /allowedTools.approvalRequired:external.send/);
assert.throws(() => normalizeSkillManifest({ ...base, prompt: 'Anahtar: process.env.NVIDIA_API_KEY' }, { source: 'user' }),
  /prompt.secretMaterial/);
assert.throws(() => normalizeSkillManifest({ ...base, prompt: 'api_key: sk-abcdefghijklmnop0123' }, { source: 'user' }),
  /prompt.secretMaterial/);
assert.throws(() => normalizeSkillManifest({ ...base, prompt: 'Token ${GITHUB_TOKEN} kullan.' }, { source: 'user' }),
  /prompt.secretMaterial/);

// Şema sertliği.
assert.throws(() => normalizeSkillManifest(base, { source: 'unknown' }), /INVALID_SKILL_MANIFEST:source/);
assert.throws(() => normalizeSkillManifest(null, { source: 'user' }), /INVALID_SKILL_MANIFEST:manifest/);
assert.throws(() => normalizeSkillManifest({ ...base, name: 'Gmail Triage' }, { source: 'user' }), /INVALID_SKILL_MANIFEST:name/);
assert.throws(() => normalizeSkillManifest({ ...base, prompt: '' }, { source: 'user' }), /INVALID_SKILL_MANIFEST:prompt/);
assert.throws(() => normalizeSkillManifest({ ...base, executionContext: 'bypass' }, { source: 'user' }), /executionContext/);
assert.throws(() => normalizeSkillManifest({ ...base, model: 'NVIDIA API KEY' }, { source: 'user' }), /INVALID_SKILL_MANIFEST:model/);
assert.throws(() => normalizeSkillManifest({ ...base, triggers: ['a', 'a'] }, { source: 'user' }), /triggers.duplicate/);
assert.throws(() => normalizeSkillManifest({
  ...base,
  arguments: [{ name: 'limit' }, { name: 'limit' }]
}, { source: 'user' }), /arguments.duplicate:limit/);
assert.throws(() => normalizeSkillManifest({
  ...base,
  arguments: [{ name: 'limit', type: 'object' }]
}, { source: 'user' }), /arguments.type:limit/);

// Project kaynağı yalnız izinli kapsamdan yüklenir ve araç kullanıyorsa fork ister.
assert.throws(() => normalizeSkillManifest(base, { source: 'project' }), /INVALID_SKILL_MANIFEST:projectScope/);
assert.throws(() => normalizeSkillManifest(base, {
  source: 'project',
  projectScope: 'hafize/other',
  allowedProjectScopes: ['hafize/main']
}), /projectScope.notAllowed:hafize\/other/);
assert.throws(() => normalizeSkillManifest(base, {
  source: 'project',
  projectScope: 'hafize/main',
  allowedProjectScopes: ['hafize/main']
}), /executionContext.projectIsolation/);
assert.throws(() => normalizeSkillManifest(base, { source: 'user', projectScope: 'hafize/main' }), /projectScope.unexpected/);

const projectSkill = normalizeSkillManifest({ ...base, executionContext: 'fork' }, {
  source: 'project',
  projectScope: 'hafize/main',
  allowedProjectScopes: ['hafize/main']
});
assert.equal(projectSkill.projectScope, 'hafize/main');
assert.equal(projectSkill.executionContext, 'fork');

// Kaynak önceliği: builtin > user > project.
const registry = createSkillRegistry({
  allowedProjectScopes: ['hafize/main'],
  entries: [
    { source: 'user', manifest: { ...base, description: 'Kullanıcı sürümü.' } },
    { source: 'builtin', manifest: { ...base, description: 'Builtin sürümü.' } },
    { source: 'project', projectScope: 'hafize/main', manifest: { name: 'repo-audit', description: 'Depoyu inceler.', prompt: 'Depoyu incele.' } }
  ]
});
assert.deepEqual(registry.list().map((skill) => skill.name), ['gmail-triage', 'repo-audit']);
assert.equal(registry.get('gmail-triage').source, 'builtin');
assert.equal(registry.get('gmail-triage').description, 'Builtin sürümü.');
assert.deepEqual(registry.shadowed, [{ name: 'gmail-triage', source: 'user', shadowedBy: 'builtin' }]);
assert.equal(registry.get('yok'), null);
assert.equal(registry.describe()[0].executionContext, 'inline');
assert.throws(() => createSkillRegistry({
  entries: [{ source: 'user', manifest: base }, { source: 'user', manifest: base }]
}), /duplicate:user::gmail-triage/);

// Ajan policy'si son sözü söyler; skill kendi yetkisini üretemez.
const gmailAgent = { toolPolicy: { default: 'deny', allow: ['connector.gmail.read'], approvalRequired: ['external.send'] } };
const readOnlyAgent = { toolPolicy: { default: 'deny', allow: ['task.read'] } };
assert.deepEqual(authorizeSkillForAgent(builtin, gmailAgent), {
  allowed: true,
  reason: 'agent_scoped',
  tools: ['connector.gmail.read']
});
const denied = authorizeSkillForAgent(builtin, readOnlyAgent);
assert.equal(denied.allowed, false);
assert.equal(denied.reason, 'tool_denied:connector.gmail.read:default_deny');
assert.deepEqual(denied.tools, []);
assert.equal(authorizeSkillForAgent(builtin, null).reason, 'invalid_agent');
assert.equal(authorizeSkillForAgent(null, gmailAgent).reason, 'invalid_skill');

assert.deepEqual(SKILLS_MANIFEST_CONTRACT.sourcePriority, ['builtin', 'user', 'project']);
assert.equal(SKILLS_MANIFEST_CONTRACT.executionContexts.includes('bypass'), false);
assert.equal(SKILLS_MANIFEST_CONTRACT.neverAllowedTools.includes('secret.read'), true);

console.log('skills manifest tests passed');
