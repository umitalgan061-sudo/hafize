import assert from 'node:assert/strict';
import { SKILL_LIMITS, normalizeSkillManifest } from '../lib/skill-manifest.mjs';

const base = {
  name: 'gunluk-ozet',
  description: 'Günlük çalışma özetini hazırlar.',
  triggers: ['Günlük özet', 'özet çıkar'],
  allowedTools: ['task.read', 'trace.write'],
  arguments: [{ name: 'tarih', required: true, description: 'ISO tarih' }, { name: 'not' }],
  model: 'nvidia/llama-3.1-70b-instruct',
  prompt: 'Kullanıcının gününü kısa maddelerle özetle.'
};

const skill = normalizeSkillManifest(base, { source: 'builtin' });
assert.equal(skill.name, 'gunluk-ozet');
assert.equal(skill.execution, 'inline');
assert.equal(skill.agentId, null);
assert.equal(skill.source, 'builtin');
assert.equal(skill.projectScope, null);
assert.deepEqual(skill.triggers, ['günlük özet', 'özet çıkar']);
assert.deepEqual(skill.allowedTools, ['task.read', 'trace.write']);
assert.deepEqual(skill.arguments[0], { name: 'tarih', required: true, description: 'ISO tarih' });
assert.equal(skill.arguments[1].required, false);
assert.equal(Object.isFrozen(skill), true);
assert.equal(Object.isFrozen(skill.triggers), true);
assert.equal(Object.isFrozen(skill.allowedTools), true);
assert.equal(Object.isFrozen(skill.arguments[0]), true);

// Kaynak yalnızca loader tarafından verilir; manifest kendi kaynağını iddia edemez.
for (const field of ['source', 'projectScope', 'toolPolicy', 'permissions', 'apiKey']) {
  assert.throws(() => normalizeSkillManifest({ ...base, [field]: 'x' }, { source: 'builtin' }), /INVALID_SKILL_MANIFEST_FIELD/);
}
for (const source of [undefined, 'system', 'remote', '']) {
  assert.throws(() => normalizeSkillManifest(base, { source }), /INVALID_SKILL_SOURCE/);
}

// Project skill yalnız açık scope ile yüklenir; builtin/user scope taşıyamaz.
const projectSkill = normalizeSkillManifest(base, { source: 'project', scope: 'umitalgan061-sudo/hafize' });
assert.equal(projectSkill.projectScope, 'umitalgan061-sudo/hafize');
assert.throws(() => normalizeSkillManifest(base, { source: 'project' }), /INVALID_SKILL_PROJECT_SCOPE/);
assert.throws(() => normalizeSkillManifest(base, { source: 'user', scope: 'x' }), /INVALID_SKILL_PROJECT_SCOPE/);

// Skill kendi tool yetkisini yükseltemez.
for (const tool of ['secret.read', 'repo.delete']) {
  assert.throws(() => normalizeSkillManifest({ ...base, allowedTools: [tool] }, { source: 'builtin' }), /SKILL_TOOL_FORBIDDEN/);
}
for (const tool of ['external.write', 'external.send', 'repo.merge', 'repo.write_branch']) {
  assert.throws(() => normalizeSkillManifest({ ...base, allowedTools: [tool] }, { source: 'builtin' }), /SKILL_TOOL_APPROVAL_ONLY/);
}
for (const tools of [['task.read', 'task.read'], ['Task.Read'], ['x '.repeat(80)], Array.from({ length: SKILL_LIMITS.maxTools + 1 }, (_, i) => `t${i}.read`)]) {
  assert.throws(() => normalizeSkillManifest({ ...base, allowedTools: tools }, { source: 'builtin' }), /INVALID_SKILL_TOOL/);
}

// Skill prompt'u secret veya credential taşıyamaz.
const secrets = [
  'Anahtar: sk-abcdefghijklmnopqrstuvwx',
  'token ghp_abcdefghijklmnopqrstuvwxyz12',
  'AWS anahtarı AKIA1234567890ABCDEF',
  'nvapi-abcdefghijklmnopqrstuvwxyz',
  'client_secret = abcdefghijklmnop',
  '-----BEGIN RSA PRIVATE KEY-----'
];
for (const prompt of secrets) {
  assert.throws(() => normalizeSkillManifest({ ...base, prompt }, { source: 'builtin' }), /SKILL_PROMPT_SECRET_DETECTED/);
}
assert.throws(
  () => normalizeSkillManifest({ ...base, description: 'api_key: abcdefghijklmnop' }, { source: 'builtin' }),
  /SKILL_DESCRIPTION_SECRET_DETECTED/
);

// inline / fork ayrımı.
const forked = normalizeSkillManifest({ ...base, execution: 'fork', agentId: 'agency-orchestrator' }, { source: 'builtin' });
assert.equal(forked.execution, 'fork');
assert.equal(forked.agentId, 'agency-orchestrator');
assert.throws(() => normalizeSkillManifest({ ...base, execution: 'fork' }, { source: 'builtin' }), /SKILL_FORK_AGENT_REQUIRED/);
assert.throws(() => normalizeSkillManifest({ ...base, agentId: 'agency-orchestrator' }, { source: 'builtin' }), /SKILL_INLINE_AGENT_NOT_ALLOWED/);
for (const execution of ['bypass', 'sandbox', '', 42]) {
  assert.throws(() => normalizeSkillManifest({ ...base, execution }, { source: 'builtin' }), /INVALID_SKILL_EXECUTION/);
}

// Alan doğrulamaları.
for (const name of ['', 'A', 'a', '-ab', 'Skill', 'skill name', 'x'.repeat(65)]) {
  assert.throws(() => normalizeSkillManifest({ ...base, name }, { source: 'builtin' }), /INVALID_SKILL_NAME/);
}
assert.throws(() => normalizeSkillManifest({ ...base, description: '' }, { source: 'builtin' }), /INVALID_SKILL_DESCRIPTION/);
assert.throws(
  () => normalizeSkillManifest({ ...base, prompt: 'x'.repeat(SKILL_LIMITS.maxPromptLength + 1) }, { source: 'builtin' }),
  /INVALID_SKILL_PROMPT/
);
assert.throws(() => normalizeSkillManifest({ ...base, model: 'HTTP://evil' }, { source: 'builtin' }), /INVALID_SKILL_MODEL/);
assert.throws(() => normalizeSkillManifest({ ...base, triggers: ['a', 'a'] }, { source: 'builtin' }), /INVALID_SKILL_TRIGGER/);
assert.throws(
  () => normalizeSkillManifest({ ...base, triggers: Array.from({ length: SKILL_LIMITS.maxTriggers + 1 }, (_, i) => `t${i}`) }, { source: 'builtin' }),
  /INVALID_SKILL_TRIGGERS/
);
assert.throws(() => normalizeSkillManifest({ ...base, arguments: [{ name: 'a', kind: 'x' }] }, { source: 'builtin' }), /INVALID_SKILL_ARGUMENT_FIELD/);
assert.throws(() => normalizeSkillManifest({ ...base, arguments: [{ name: 'A' }] }, { source: 'builtin' }), /INVALID_SKILL_ARGUMENT/);
assert.throws(() => normalizeSkillManifest({ ...base, arguments: [{ name: 'a' }, { name: 'a' }] }, { source: 'builtin' }), /INVALID_SKILL_ARGUMENT/);
for (const input of [null, [], 'skill', 42]) {
  assert.throws(() => normalizeSkillManifest(input, { source: 'builtin' }), /INVALID_SKILL_MANIFEST/);
}

console.log('skill manifest tests passed');
