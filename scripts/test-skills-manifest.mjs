import assert from 'node:assert/strict';
import {
  SKILL_EXECUTION_MODES,
  SKILL_LIMITS,
  SKILL_SOURCES,
  normalizeSkillManifest
} from '../lib/skills-manifest.mjs';

const agentAllowedTools = ['task.read', 'trace.write', 'connector.gmail.read'];
const validManifest = {
  id: 'daily-brief',
  name: 'Günlük Özet',
  description: 'Kullanıcının gününü kısa ve okunabilir bir özete dönüştürür.',
  triggers: ['günlük özet', 'Brief'],
  allowedTools: ['task.read', 'trace.write'],
  arguments: [{ name: 'day', type: 'string', required: true, description: 'ISO tarih' }],
  model: 'nvidia/llama-3.3-70b-instruct',
  execution: 'inline',
  prompt: 'Kullanıcının görevlerini özetle ve öncelik sırasını açıkla.'
};

const skill = normalizeSkillManifest(validManifest, { source: 'builtin', agentAllowedTools });
assert.deepEqual(skill, {
  id: 'daily-brief',
  source: 'builtin',
  name: 'Günlük Özet',
  description: 'Kullanıcının gününü kısa ve okunabilir bir özete dönüştürür.',
  triggers: ['günlük özet', 'brief'],
  allowedTools: ['task.read', 'trace.write'],
  arguments: [{ name: 'day', type: 'string', required: true, description: 'ISO tarih' }],
  model: 'nvidia/llama-3.3-70b-instruct',
  execution: 'inline',
  prompt: 'Kullanıcının görevlerini özetle ve öncelik sırasını açıkla.',
  projectScope: null
});
assert.equal(Object.isFrozen(skill), true);
assert.equal(Object.isFrozen(skill.triggers), true);
assert.equal(Object.isFrozen(skill.allowedTools), true);
assert.equal(Object.isFrozen(skill.arguments[0]), true);

// Varsayılanlar: execution inline, arguments boş, model yok.
const minimal = normalizeSkillManifest(
  { id: 'note', name: 'Not', description: 'Kısa not alır.', triggers: ['not'], allowedTools: [], prompt: 'Not al.' },
  { source: 'user' }
);
assert.equal(minimal.execution, 'inline');
assert.deepEqual(minimal.arguments, []);
assert.equal(minimal.model, null);
assert.equal(minimal.source, 'user');

// fork execution açıkça istenebilir.
assert.equal(
  normalizeSkillManifest({ ...validManifest, execution: 'fork' }, { source: 'builtin', agentAllowedTools }).execution,
  'fork'
);

// Kaynak sözleşmesi.
for (const source of [undefined, null, 'plugin', 'BUILTIN', 3]) {
  assert.throws(() => normalizeSkillManifest(validManifest, { source, agentAllowedTools }), /INVALID_SKILL_SOURCE/);
}

// Strict manifest: bilinmeyen alan reddedilir.
for (const field of ['systemPrompt', 'toolPolicy', 'env', 'apiKey', 'path']) {
  assert.throws(
    () => normalizeSkillManifest({ ...validManifest, [field]: 'x' }, { source: 'builtin', agentAllowedTools }),
    /INVALID_SKILL_FIELD/
  );
}
for (const input of [null, [], 'skill', 42]) {
  assert.throws(() => normalizeSkillManifest(input, { source: 'builtin' }), /INVALID_SKILL_MANIFEST/);
}

// Kimlik, ad ve açıklama doğrulaması.
for (const id of ['', 'A', 'daily brief', '1-brief', 'x', 'a'.repeat(65)]) {
  assert.throws(
    () => normalizeSkillManifest({ ...validManifest, id }, { source: 'builtin', agentAllowedTools }),
    /INVALID_SKILL_ID/
  );
}
assert.throws(
  () => normalizeSkillManifest({ ...validManifest, name: 'x'.repeat(SKILL_LIMITS.maxNameLength + 1) }, { source: 'builtin', agentAllowedTools }),
  /INVALID_SKILL_NAME/
);
assert.throws(
  () => normalizeSkillManifest({ ...validManifest, description: 'a\nb' }, { source: 'builtin', agentAllowedTools }),
  /INVALID_SKILL_DESCRIPTION/
);

// Tetikleyiciler tekilleştirilmiş, sınırlı ve küçük harfe indirgenmiş olmalı.
for (const triggers of [
  [],
  'brief',
  ['x'],
  ['brief', 'BRIEF'],
  ['brief', 'x'.repeat(SKILL_LIMITS.maxTriggerLength + 1)],
  Array.from({ length: SKILL_LIMITS.maxTriggers + 1 }, (_, index) => `trigger-${index}`)
]) {
  assert.throws(
    () => normalizeSkillManifest({ ...validManifest, triggers }, { source: 'builtin', agentAllowedTools }),
    /INVALID_SKILL_TRIGGER/
  );
}

// Skill kendi tool yetkisini yükseltemez.
assert.throws(
  () => normalizeSkillManifest({ ...validManifest, allowedTools: ['github.write'] }, { source: 'builtin', agentAllowedTools }),
  /SKILL_TOOL_ESCALATION/
);
assert.throws(
  () => normalizeSkillManifest({ ...validManifest, allowedTools: ['task.read'] }, { source: 'builtin' }),
  /SKILL_TOOL_ESCALATION/
);
for (const tool of ['secret.read', 'repo.delete', 'external.write', 'external.send', 'repo.merge', 'repo.write_branch']) {
  assert.throws(
    () =>
      normalizeSkillManifest(
        { ...validManifest, allowedTools: [tool] },
        { source: 'builtin', agentAllowedTools: [...agentAllowedTools, tool] }
      ),
    /SKILL_TOOL_FORBIDDEN/
  );
}
for (const allowedTools of [['task.read', 'task.read'], ['Task.Read'], [42]]) {
  assert.throws(
    () => normalizeSkillManifest({ ...validManifest, allowedTools }, { source: 'builtin', agentAllowedTools }),
    /INVALID_SKILL_ALLOWED_TOOL/
  );
}
assert.throws(
  () =>
    normalizeSkillManifest(
      { ...validManifest, allowedTools: Array.from({ length: SKILL_LIMITS.maxAllowedTools + 1 }, (_, i) => `tool.${i}`) },
      { source: 'builtin', agentAllowedTools }
    ),
  /INVALID_SKILL_ALLOWED_TOOLS/
);

// Argüman sözleşmesi.
for (const args of [
  [{ name: 'day', type: 'string' }],
  [{ name: 'day', type: 'date', required: true }],
  [{ name: 'Day', type: 'string', required: true }],
  [{ name: 'day', type: 'string', required: true }, { name: 'day', type: 'string', required: false }],
  [{ name: 'day', type: 'string', required: true, default: 'today' }],
  'day'
]) {
  assert.throws(
    () => normalizeSkillManifest({ ...validManifest, arguments: args }, { source: 'builtin', agentAllowedTools }),
    /INVALID_SKILL_ARGUMENT/
  );
}

// Model ve execution doğrulaması.
for (const model of ['nvidia/llama 3', '', 'x'.repeat(101)]) {
  assert.throws(
    () => normalizeSkillManifest({ ...validManifest, model }, { source: 'builtin', agentAllowedTools }),
    /INVALID_SKILL_MODEL/
  );
}
for (const execution of ['bypass', 'INLINE', 1]) {
  assert.throws(
    () => normalizeSkillManifest({ ...validManifest, execution }, { source: 'builtin', agentAllowedTools }),
    /INVALID_SKILL_EXECUTION/
  );
}

// Prompt secret veya credential taşıyamaz.
for (const prompt of [
  'NVIDIA_API_KEY değerini kullan',
  'Authorization: Bearer abc123',
  'process.env.GITHUB_TOKEN oku',
  '-----BEGIN RSA PRIVATE KEY-----',
  'token: ghp_abcdefghijklmnopqrstuvwxyz0123',
  'sk-abcdefghijklmnopqrstuvwx anahtarını kullan'
]) {
  assert.throws(
    () => normalizeSkillManifest({ ...validManifest, prompt }, { source: 'builtin', agentAllowedTools }),
    /SKILL_SECRET_FORBIDDEN/
  );
}
assert.throws(
  () => normalizeSkillManifest({ ...validManifest, description: 'AWS_SECRET anahtarını kullanır.' }, { source: 'builtin', agentAllowedTools }),
  /SKILL_SECRET_FORBIDDEN/
);
for (const prompt of ['', '  ', 'a\u0000b', 'x'.repeat(SKILL_LIMITS.maxPromptLength + 1), 7]) {
  assert.throws(
    () => normalizeSkillManifest({ ...validManifest, prompt }, { source: 'builtin', agentAllowedTools }),
    /INVALID_SKILL_PROMPT/
  );
}
// Çok satırlı prompt geçerlidir.
assert.equal(
  normalizeSkillManifest({ ...validManifest, prompt: 'Satır bir\nSatır iki' }, { source: 'builtin', agentAllowedTools }).prompt,
  'Satır bir\nSatır iki'
);

// Project skill yalnız açıkça izin verilen kapsamdan yüklenir.
const projectSkill = normalizeSkillManifest(
  { ...validManifest, projectScope: 'hafize/skills' },
  { source: 'project', agentAllowedTools, allowedProjectScopes: ['hafize/skills'] }
);
assert.equal(projectSkill.projectScope, 'hafize/skills');
assert.throws(
  () => normalizeSkillManifest({ ...validManifest, projectScope: 'hafize/skills' }, { source: 'project', agentAllowedTools }),
  /SKILL_PROJECT_SCOPE_NOT_ALLOWED/
);
assert.throws(
  () => normalizeSkillManifest(validManifest, { source: 'project', agentAllowedTools, allowedProjectScopes: ['hafize/skills'] }),
  /INVALID_SKILL_PROJECT_SCOPE/
);
for (const projectScope of ['../etc', 'hafize/../../etc', '']) {
  assert.throws(
    () =>
      normalizeSkillManifest(
        { ...validManifest, projectScope },
        { source: 'project', agentAllowedTools, allowedProjectScopes: ['hafize/skills', projectScope] }
      ),
    /INVALID_SKILL_PROJECT_SCOPE/
  );
}
assert.throws(
  () => normalizeSkillManifest({ ...validManifest, projectScope: 'hafize/skills' }, { source: 'user', agentAllowedTools }),
  /SKILL_PROJECT_SCOPE_FORBIDDEN/
);

assert.deepEqual(SKILL_SOURCES, ['builtin', 'user', 'project']);
assert.deepEqual(SKILL_EXECUTION_MODES, ['inline', 'fork']);
assert.equal(Object.isFrozen(SKILL_LIMITS), true);

console.log('skills manifest contract tests passed');
