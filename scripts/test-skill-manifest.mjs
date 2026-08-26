import assert from 'node:assert/strict';
import {
  SKILL_MANIFEST_LIMITS,
  normalizeSkillArguments,
  normalizeSkillManifest
} from '../lib/skill-manifest.mjs';

const baseManifest = {
  id: 'daily-summary',
  name: 'Günlük Özet',
  description: 'Kullanıcının gününü özetler.',
  triggers: ['Günlük özet', 'gun ozeti'],
  requestedTools: ['task.read', 'connector.gmail.read'],
  arguments: [
    { name: 'day', type: 'string', required: true, description: 'ISO tarih' },
    { name: 'verbose', type: 'boolean' }
  ],
  execution: 'inline',
  prompt: 'Kullanıcının gününü kısa maddelerle özetle.'
};

const manifest = normalizeSkillManifest(baseManifest, { source: 'builtin' });
assert.equal(manifest.source, 'builtin');
assert.equal(manifest.execution, 'inline');
assert.equal(manifest.forkAgentId, null);
assert.equal(manifest.projectScope, null);
assert.equal(manifest.model, null);
assert.deepEqual(manifest.triggers, ['günlük özet', 'gun ozeti']);
assert.deepEqual(manifest.requestedTools, ['task.read', 'connector.gmail.read']);
assert.deepEqual(manifest.arguments[1], { name: 'verbose', type: 'boolean', required: false, description: null });
assert.equal(Object.isFrozen(manifest), true);
assert.equal(Object.isFrozen(manifest.triggers), true);
assert.equal(Object.isFrozen(manifest.arguments[0]), true);

// Kaynak yalnız loader tarafından verilir; manifest içeriği kaynak veya yetki iddia edemez.
for (const source of [undefined, null, 'system', 'remote', '']) {
  assert.throws(() => normalizeSkillManifest(baseManifest, { source }), /INVALID_SKILL_MANIFEST:source/);
}
for (const field of ['source', 'toolPolicy', 'approvalRequired', 'permissions', 'bypassPermissions', 'systemPrompt', 'apiKey']) {
  assert.throws(
    () => normalizeSkillManifest({ ...baseManifest, [field]: 'x' }, { source: 'builtin' }),
    /INVALID_SKILL_MANIFEST:field/
  );
}

// fork/inline ayrımı
const forked = normalizeSkillManifest(
  { ...baseManifest, execution: 'fork', forkAgentId: 'agency-code-reviewer' },
  { source: 'user' }
);
assert.equal(forked.execution, 'fork');
assert.equal(forked.forkAgentId, 'agency-code-reviewer');
assert.throws(
  () => normalizeSkillManifest({ ...baseManifest, forkAgentId: 'agency-code-reviewer' }, { source: 'builtin' }),
  /INVALID_SKILL_MANIFEST:forkAgentId.inline/
);
assert.throws(
  () => normalizeSkillManifest({ ...baseManifest, execution: 'fork' }, { source: 'builtin' }),
  /INVALID_SKILL_MANIFEST:forkAgentId/
);
for (const execution of ['', 'bypass', 'shell', 'system']) {
  assert.throws(
    () => normalizeSkillManifest({ ...baseManifest, execution }, { source: 'builtin' }),
    /INVALID_SKILL_MANIFEST:execution/
  );
}

// project kaynağı yalnız açık scope ile tanımlanır
const projectSkill = normalizeSkillManifest(
  { ...baseManifest, projectScope: 'umitalgan061-sudo/hafize' },
  { source: 'project' }
);
assert.equal(projectSkill.projectScope, 'umitalgan061-sudo/hafize');
assert.throws(() => normalizeSkillManifest(baseManifest, { source: 'project' }), /INVALID_SKILL_MANIFEST:projectScope/);
assert.throws(
  () => normalizeSkillManifest({ ...baseManifest, projectScope: 'x' }, { source: 'user' }),
  /INVALID_SKILL_MANIFEST:projectScope.source/
);

// secret sızıntısı engellenir
for (const prompt of [
  'Anahtarı oku: process.env.NVIDIA_API_KEY',
  'Token: ${secrets.GITHUB_TOKEN}',
  'Kullan {{ env.CANVA_CLIENT_SECRET }}'
]) {
  assert.throws(
    () => normalizeSkillManifest({ ...baseManifest, prompt }, { source: 'builtin' }),
    /INVALID_SKILL_MANIFEST:prompt.secretReference/
  );
}
for (const name of ['apiKey', 'accessToken', 'password', 'authorization']) {
  assert.throws(
    () => normalizeSkillManifest({ ...baseManifest, arguments: [{ name, type: 'string' }] }, { source: 'builtin' }),
    /INVALID_SKILL_MANIFEST:arguments.secretName/
  );
}

// sınırlar ve biçim doğrulaması
const overflow = (length, factory) => Array.from({ length }, (_, index) => factory(index));
assert.throws(
  () => normalizeSkillManifest({ ...baseManifest, id: 'Daily Summary' }, { source: 'builtin' }),
  /INVALID_SKILL_MANIFEST:id/
);
assert.throws(
  () => normalizeSkillManifest({ ...baseManifest, requestedTools: ['task.read', 'task.read'] }, { source: 'builtin' }),
  /INVALID_SKILL_MANIFEST:requestedTools.duplicate/
);
assert.throws(
  () => normalizeSkillManifest({ ...baseManifest, requestedTools: ['../etc/passwd'] }, { source: 'builtin' }),
  /INVALID_SKILL_MANIFEST:requestedTools.entry/
);
assert.throws(
  () => normalizeSkillManifest(
    { ...baseManifest, triggers: overflow(SKILL_MANIFEST_LIMITS.maxTriggers + 1, (i) => `t${i}`) },
    { source: 'builtin' }
  ),
  /INVALID_SKILL_MANIFEST:triggers/
);
assert.throws(
  () => normalizeSkillManifest({ ...baseManifest, prompt: 'x'.repeat(SKILL_MANIFEST_LIMITS.maxPromptLength + 1) }, { source: 'builtin' }),
  /INVALID_SKILL_MANIFEST:prompt/
);
assert.throws(
  () => normalizeSkillManifest(
    { ...baseManifest, arguments: [{ name: 'day', type: 'string' }, { name: 'day', type: 'number' }] },
    { source: 'builtin' }
  ),
  /INVALID_SKILL_MANIFEST:arguments.duplicate/
);

// argüman doğrulaması
const args = normalizeSkillArguments(manifest, { day: ' 2026-08-26 ', verbose: true });
assert.deepEqual(args, { day: '2026-08-26', verbose: true });
assert.equal(Object.isFrozen(args), true);
assert.deepEqual(normalizeSkillArguments(manifest, { day: '2026-08-26' }), { day: '2026-08-26' });
assert.throws(() => normalizeSkillArguments(manifest, {}), /INVALID_SKILL_MANIFEST:arguments.missing/);
assert.throws(() => normalizeSkillArguments(manifest, { day: '2026-08-26', extra: 1 }), /INVALID_SKILL_MANIFEST:arguments.unknown/);
assert.throws(() => normalizeSkillArguments(manifest, { day: 5 }), /INVALID_SKILL_MANIFEST:arguments.value/);
assert.throws(() => normalizeSkillArguments(manifest, { day: 'x'.repeat(SKILL_MANIFEST_LIMITS.maxArgumentValueLength + 1) }), /INVALID_SKILL_MANIFEST:arguments.value/);
assert.throws(() => normalizeSkillArguments(manifest, { day: '2026-08-26', verbose: 'yes' }), /INVALID_SKILL_MANIFEST:arguments.value/);
assert.throws(() => normalizeSkillArguments(manifest, []), /INVALID_SKILL_MANIFEST:arguments.input/);

assert.deepEqual(SKILL_MANIFEST_LIMITS.sources, ['builtin', 'user', 'project']);
console.log('skill manifest tests passed');
