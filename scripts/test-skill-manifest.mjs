import assert from 'node:assert/strict';
import {
  SKILL_EXECUTIONS,
  SKILL_SOURCES,
  containsSecretMaterial,
  normalizeSkillManifest
} from '../lib/skill-manifest.mjs';

assert.deepEqual([...SKILL_SOURCES], ['builtin', 'user', 'project']);
assert.deepEqual([...SKILL_EXECUTIONS], ['inline', 'fork']);

const base = {
  name: 'Daily-Brief',
  description: 'Günlük özet hazırlar.',
  triggers: ['Günlük Özet', 'brief'],
  allowedTools: ['connector.gmail.read', 'runtime.status'],
  arguments: [{ name: 'day', description: 'Hangi gün', required: true }],
  execution: 'inline',
  model: 'nvidia/llama-3.3-70b',
  prompt: 'Kullanıcının gününü kısa maddelerle özetle.'
};

const ok = normalizeSkillManifest(base, { source: 'builtin' });
assert.equal(ok.ok, true);
assert.equal(ok.skill.name, 'daily-brief');
assert.deepEqual([...ok.skill.triggers], ['günlük özet', 'brief']);
assert.equal(ok.skill.arguments[0].required, true);
assert.equal(ok.skill.arguments[0].maxLength, 2000);
assert.equal(ok.skill.scope, null);
assert.throws(() => { ok.skill.name = 'other'; }, TypeError);

// Kaynak sözleşmesi
assert.equal(normalizeSkillManifest(base, { source: 'plugin' }).error, 'INVALID_SKILL_SOURCE');
assert.equal(normalizeSkillManifest(null, { source: 'user' }).error, 'INVALID_SKILL_MANIFEST');

// Project skill yalnız açık scope ile tanımlanır; diğer kaynaklar scope taşıyamaz.
const projectMissingScope = normalizeSkillManifest(base, { source: 'project' });
assert.equal(projectMissingScope.error, 'INVALID_SKILL_SCOPE');
const projectScoped = normalizeSkillManifest({ ...base, scope: 'repo:hafize' }, { source: 'project' });
assert.equal(projectScoped.skill.scope, 'repo:hafize');
assert.equal(
  normalizeSkillManifest({ ...base, scope: 'repo:hafize' }, { source: 'user' }).error,
  'SKILL_SCOPE_NOT_ALLOWED'
);

// Skill kendi yetkisini yükseltemez.
assert.equal(
  normalizeSkillManifest({ ...base, allowedTools: ['secret.read'] }, { source: 'user' }).error,
  'SKILL_TOOL_FORBIDDEN:secret.read'
);
assert.equal(
  normalizeSkillManifest({ ...base, allowedTools: ['external.send'] }, { source: 'user' }).error,
  'SKILL_TOOL_APPROVAL_ONLY:external.send'
);
assert.equal(
  normalizeSkillManifest({ ...base, allowedTools: ['repo.write_branch'] }, { source: 'builtin' }).error,
  'SKILL_TOOL_APPROVAL_ONLY:repo.write_branch'
);
assert.equal(
  normalizeSkillManifest({ ...base, allowedTools: ['NOT VALID'] }, { source: 'user' }).error,
  'INVALID_SKILL_TOOLS'
);
assert.equal(
  normalizeSkillManifest({ ...base, allowedTools: ['task.read', 'task.read'] }, { source: 'user' }).error,
  'INVALID_SKILL_TOOLS'
);

// Skill prompt'u credential taşıyamaz.
assert.equal(containsSecretMaterial('nvapi-0123456789abcdefghij'), true);
assert.equal(containsSecretMaterial('api_key: 0123456789abcdef'), true);
assert.equal(containsSecretMaterial('Normal bir skill metni.'), false);
assert.equal(
  normalizeSkillManifest({ ...base, prompt: 'Anahtar: ghp_0123456789abcdefghij' }, { source: 'user' }).error,
  'SKILL_PROMPT_SECRET_MATERIAL'
);
assert.equal(
  normalizeSkillManifest({ ...base, description: 'client_secret=abcdef0123456789' }, { source: 'user' }).error,
  'SKILL_PROMPT_SECRET_MATERIAL'
);

// Alan doğrulamaları
assert.equal(normalizeSkillManifest({ ...base, name: 'A' }, { source: 'user' }).error, 'INVALID_SKILL_NAME');
assert.equal(normalizeSkillManifest({ ...base, description: '' }, { source: 'user' }).error, 'INVALID_SKILL_DESCRIPTION');
assert.equal(normalizeSkillManifest({ ...base, prompt: '' }, { source: 'user' }).error, 'INVALID_SKILL_PROMPT');
assert.equal(normalizeSkillManifest({ ...base, execution: 'bypass' }, { source: 'user' }).error, 'INVALID_SKILL_EXECUTION');
assert.equal(normalizeSkillManifest({ ...base, model: 'boşluk var' }, { source: 'user' }).error, 'INVALID_SKILL_MODEL');
assert.equal(
  normalizeSkillManifest({ ...base, triggers: new Array(13).fill('x').map((item, index) => item + index) }, { source: 'user' }).error,
  'INVALID_SKILL_TRIGGERS'
);
assert.equal(
  normalizeSkillManifest({ ...base, arguments: [{ name: '1bad' }] }, { source: 'user' }).error,
  'INVALID_SKILL_ARGUMENTS'
);
assert.equal(
  normalizeSkillManifest({ ...base, arguments: [{ name: 'day', maxLength: 0 }] }, { source: 'user' }).error,
  'INVALID_SKILL_ARGUMENTS'
);
assert.equal(normalizeSkillManifest({ ...base, prompt: 'x'.repeat(20_001) }, { source: 'user' }).error, 'INVALID_SKILL_PROMPT');

const minimal = normalizeSkillManifest(
  { name: 'notes', description: 'Not alır.', prompt: 'Notları düzenle.' },
  { source: 'user' }
);
assert.equal(minimal.ok, true);
assert.equal(minimal.skill.execution, 'inline');
assert.equal(minimal.skill.model, null);
assert.deepEqual([...minimal.skill.allowedTools], []);

console.log('skill manifest tests passed');
