import assert from 'node:assert/strict';
import {
  normalizeSkillManifest,
  SKILL_EXECUTION_MODES,
  SKILL_SOURCE_PRECEDENCE,
  SKILL_SOURCES
} from '../lib/skill-manifest.mjs';

const base = {
  name: 'gunluk-ozet',
  description: 'Kullanıcının günlük görevlerini özetler.',
  triggers: ['Günlük Özet', 'gunluk ozet'],
  allowedTools: ['task.read', 'runtime.status'],
  arguments: [{ name: 'gun', type: 'string', required: true, description: 'Özetlenecek gün.' }],
  model: 'nvidia/llama-3.3-70b-instruct',
  prompt: 'Kullanıcının açık görevlerini kısa maddelerle özetle.'
};

assert.deepEqual(SKILL_SOURCES, ['builtin', 'user', 'project']);
assert.deepEqual(SKILL_EXECUTION_MODES, ['inline', 'fork']);
assert.equal(SKILL_SOURCE_PRECEDENCE.project > SKILL_SOURCE_PRECEDENCE.user, true);
assert.equal(SKILL_SOURCE_PRECEDENCE.user > SKILL_SOURCE_PRECEDENCE.builtin, true);

const valid = normalizeSkillManifest(base, { source: 'builtin' });
assert.equal(valid.ok, true);
assert.equal(valid.skill.name, 'gunluk-ozet');
assert.equal(valid.skill.execution, 'inline');
assert.equal(valid.skill.executionAgentId, '');
assert.equal(valid.skill.projectScope, '');
assert.deepEqual([...valid.skill.triggers], ['günlük özet', 'gunluk ozet']);
assert.deepEqual([...valid.skill.allowedTools], ['task.read', 'runtime.status']);
assert.equal(valid.skill.arguments[0].required, true);
assert.throws(() => { valid.skill.allowedTools.push('external.write'); });

assert.equal(normalizeSkillManifest(base, { source: 'unknown' }).error, 'INVALID_SKILL:source');
assert.equal(normalizeSkillManifest(null, { source: 'user' }).error, 'INVALID_SKILL:manifest');
assert.equal(normalizeSkillManifest({ ...base, extra: 1 }, { source: 'user' }).error, 'INVALID_SKILL:unknownField:extra');
assert.equal(normalizeSkillManifest({ ...base, name: 'Bad Name' }, { source: 'user' }).error, 'INVALID_SKILL:name');
assert.equal(normalizeSkillManifest({ ...base, description: '' }, { source: 'user' }).error, 'INVALID_SKILL:description');
assert.equal(normalizeSkillManifest({ ...base, triggers: [] }, { source: 'user' }).error, 'INVALID_SKILL:triggers');
assert.equal(normalizeSkillManifest({ ...base, triggers: ['a', 'a'] }, { source: 'user' }).error, 'INVALID_SKILL:triggers');
assert.equal(normalizeSkillManifest({ ...base, prompt: '  ' }, { source: 'user' }).error, 'INVALID_SKILL:prompt');
assert.equal(normalizeSkillManifest({ ...base, model: 'boşluklu model' }, { source: 'user' }).error, 'INVALID_SKILL:model');

// Skill kendi tool yetkisini yükseltemez.
for (const tool of ['secret.read', 'repo.delete', 'external.write', 'external.send', 'repo.merge']) {
  assert.equal(
    normalizeSkillManifest({ ...base, allowedTools: [tool] }, { source: 'user' }).error,
    'INVALID_SKILL:allowedTools',
    tool
  );
}

// Skill prompt'u secret veya credential taşıyamaz.
const credentialPrompts = [
  'Şu anahtarı kullan: sk-abcdefghijklmnopqrstuvwx',
  'Token: ghp_abcdefghijklmnopqrstuvwxyz012345',
  'api_key = ABCDEFGH12345678',
  'Authorization: Bearer abcdefghijklmnopqrstuvwxyz',
  'Anahtarı process.env.NVIDIA_API_KEY içinden oku'
];
for (const prompt of credentialPrompts) {
  assert.equal(
    normalizeSkillManifest({ ...base, prompt }, { source: 'user' }).error,
    'INVALID_SKILL:credentialInPrompt',
    prompt
  );
}

// inline/fork execution sözleşmesi.
assert.equal(normalizeSkillManifest({ ...base, execution: 'bypass' }, { source: 'user' }).error, 'INVALID_SKILL:execution');
assert.equal(normalizeSkillManifest({ ...base, execution: 'fork' }, { source: 'user' }).error, 'INVALID_SKILL:executionAgentId');
assert.equal(
  normalizeSkillManifest({ ...base, executionAgentId: 'agency-orchestrator' }, { source: 'user' }).error,
  'INVALID_SKILL:executionAgentId'
);
const forked = normalizeSkillManifest(
  { ...base, execution: 'fork', executionAgentId: 'agency-orchestrator' },
  { source: 'user' }
);
assert.equal(forked.ok, true);
assert.equal(forked.skill.executionAgentId, 'agency-orchestrator');

// Project skill yalnız açıkça izin verilen kapsamdan yüklenir.
assert.equal(normalizeSkillManifest(base, { source: 'project' }).error, 'INVALID_SKILL:projectScope');
assert.equal(
  normalizeSkillManifest({ ...base, projectScope: 'umitalgan061-sudo/other' }, { source: 'project', allowedProjectScopes: ['umitalgan061-sudo/hafize'] }).error,
  'INVALID_SKILL:projectScopeNotAllowed'
);
const scoped = normalizeSkillManifest(
  { ...base, projectScope: 'umitalgan061-sudo/hafize' },
  { source: 'project', allowedProjectScopes: ['umitalgan061-sudo/hafize'] }
);
assert.equal(scoped.ok, true);
assert.equal(scoped.skill.projectScope, 'umitalgan061-sudo/hafize');
assert.equal(normalizeSkillManifest({ ...base, projectScope: 'x' }, { source: 'builtin' }).error, 'INVALID_SKILL:projectScope');

// Argüman sözleşmesi.
assert.equal(normalizeSkillManifest({ ...base, arguments: [{ name: 'gun', type: 'date' }] }, { source: 'user' }).error, 'INVALID_SKILL:arguments');
assert.equal(
  normalizeSkillManifest({ ...base, arguments: [{ name: 'gun', type: 'string' }, { name: 'gun', type: 'number' }] }, { source: 'user' }).error,
  'INVALID_SKILL:arguments'
);
const noArgs = normalizeSkillManifest({ ...base, arguments: undefined, allowedTools: undefined }, { source: 'user' });
assert.equal(noArgs.ok, true);
assert.deepEqual([...noArgs.skill.arguments], []);
assert.deepEqual([...noArgs.skill.allowedTools], []);

console.log('skill manifest tests passed');
