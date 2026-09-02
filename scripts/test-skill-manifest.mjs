import assert from 'node:assert/strict';
import {
  SKILL_EXECUTIONS,
  SKILL_SOURCES,
  buildSkillRegistry,
  normalizeSkillManifest
} from '../lib/skill-manifest.mjs';

const allowedTools = new Set(['repo.read', 'runtime.status', 'trace.write']);
const allowedProjectScopes = new Set(['umitalgan061-sudo/hafize']);
const base = {
  name: 'release-notes',
  description: 'Sürüm notlarını hazırlar.',
  prompt: 'Son commitleri özetle ve sürüm notu taslağı üret.'
};

assert.deepEqual(SKILL_SOURCES, ['builtin', 'user', 'project']);
assert.deepEqual(SKILL_EXECUTIONS, ['inline', 'fork']);
const builtin = normalizeSkillManifest(base, { source: 'builtin', allowedTools });
assert.equal(builtin.source, 'builtin');
assert.equal(builtin.execution, 'inline');
assert.equal(builtin.model, null);
assert.equal(builtin.scope, null);
assert.deepEqual(builtin.triggers, []);
assert.deepEqual(builtin.allowedTools, []);
assert.deepEqual(builtin.arguments, []);
assert.throws(() => { builtin.name = 'other'; }, TypeError);

const full = normalizeSkillManifest({
  ...base,
  triggers: ['sürüm notu', 'release notes'],
  allowedTools: ['repo.read', 'trace.write'],
  arguments: [{ name: 'tag', description: 'Sürüm etiketi.', required: true }, { name: 'lang', description: 'Dil.' }],
  execution: 'fork',
  model: 'nvidia/llama-3.3-70b-instruct'
}, { source: 'user', allowedTools });
assert.deepEqual(full.allowedTools, ['repo.read', 'trace.write']);
assert.equal(full.arguments[0].required, true);
assert.equal(full.arguments[1].required, false);
assert.equal(full.model, 'nvidia/llama-3.3-70b-instruct');

// Skill kendi araç yetkisini yükseltemez.
assert.throws(
  () => normalizeSkillManifest({ ...base, allowedTools: ['repo.merge'] }, { source: 'builtin', allowedTools }),
  /SKILL_MANIFEST_TOOL_ESCALATION/
);
assert.throws(
  () => normalizeSkillManifest(base, { source: 'builtin', allowedTools: ['repo.read'] }),
  /INVALID_SKILL_MANIFEST_TOOL_POLICY/
);

// inline skill model bağlamını değiştiremez.
assert.throws(
  () => normalizeSkillManifest({ ...base, model: 'x' }, { source: 'builtin', allowedTools }),
  /SKILL_MANIFEST_INLINE_MODEL_OVERRIDE/
);

// Skill metinleri credential taşıyamaz.
for (const field of ['prompt', 'description']) {
  assert.throws(
    () => normalizeSkillManifest({ ...base, [field]: 'NVIDIA_API_KEY = nvapi-super-secret' }, { source: 'builtin', allowedTools }),
    /SKILL_MANIFEST_SECRET_REJECTED/
  );
}
assert.throws(
  () => normalizeSkillManifest({ ...base, prompt: 'Authorization: Bearer ya29.abcdefghijkl' }, { source: 'builtin', allowedTools }),
  /SKILL_MANIFEST_SECRET_REJECTED/
);

// Project skill yalnız açıkça izin verilen kapsamdan yüklenir.
const project = normalizeSkillManifest(
  { ...base, name: 'project-audit', scope: 'umitalgan061-sudo/hafize' },
  { source: 'project', allowedTools, allowedProjectScopes }
);
assert.equal(project.scope, 'umitalgan061-sudo/hafize');
for (const scope of [undefined, 'other/repo', '../escape', 'umitalgan061-sudo/hafize/../x']) {
  assert.throws(
    () => normalizeSkillManifest({ ...base, scope }, { source: 'project', allowedTools, allowedProjectScopes }),
    /INVALID_SKILL_MANIFEST_SCOPE|SKILL_MANIFEST_PROJECT_SCOPE_NOT_ALLOWED/
  );
}
assert.throws(
  () => normalizeSkillManifest({ ...base, scope: 'umitalgan061-sudo/hafize' }, { source: 'user', allowedTools }),
  /INVALID_SKILL_MANIFEST_SCOPE/
);

// Strict manifest doğrulaması.
for (const [input, pattern] of [
  [null, /INVALID_SKILL_MANIFEST$/],
  [{ ...base, unknown: 1 }, /INVALID_SKILL_MANIFEST_FIELD/],
  [{ ...base, name: 'Release Notes' }, /INVALID_SKILL_MANIFEST_NAME/],
  [{ ...base, description: '' }, /INVALID_SKILL_MANIFEST_DESCRIPTION/],
  [{ ...base, prompt: 42 }, /INVALID_SKILL_MANIFEST_PROMPT/],
  [{ ...base, triggers: ['a', 'a'] }, /INVALID_SKILL_MANIFEST_TRIGGERS/],
  [{ ...base, execution: 'bypass' }, /INVALID_SKILL_MANIFEST_EXECUTION/],
  [{ ...base, arguments: [{ name: 'tag' }] }, /INVALID_SKILL_MANIFEST_ARGUMENTS/],
  [{ ...base, arguments: [{ name: 'tag', description: 'a', extra: 1 }] }, /INVALID_SKILL_MANIFEST_ARGUMENTS/]
]) {
  assert.throws(() => normalizeSkillManifest(input, { source: 'builtin', allowedTools }), pattern);
}
assert.throws(() => normalizeSkillManifest(base, { source: 'plugin', allowedTools }), /INVALID_SKILL_MANIFEST_SOURCE/);

// Kaynak önceliği: proje deposu builtin veya user skill adını gölgeleyemez.
const userSkill = normalizeSkillManifest({ ...base, prompt: 'user sürümü' }, { source: 'user', allowedTools });
const projectShadow = normalizeSkillManifest(
  { ...base, scope: 'umitalgan061-sudo/hafize', prompt: 'proje sürümü' },
  { source: 'project', allowedTools, allowedProjectScopes }
);
const registry = buildSkillRegistry([projectShadow, userSkill, builtin, project]);
assert.deepEqual(registry.skills.map((skill) => skill.name), ['project-audit', 'release-notes']);
assert.equal(registry.get('release-notes').source, 'builtin');
assert.equal(registry.get('project-audit').source, 'project');
assert.equal(registry.get('missing'), null);
assert.equal(registry.get(null), null);
// Her gölgeleme olayı ayrı ayrı raporlanır; kazanan her zaman daha güvenilir kaynaktır.
assert.deepEqual(registry.shadowed, [
  { name: 'release-notes', ignoredSource: 'project', keptSource: 'user' },
  { name: 'release-notes', ignoredSource: 'user', keptSource: 'builtin' }
]);

assert.throws(() => buildSkillRegistry([userSkill, userSkill]), /SKILL_REGISTRY_DUPLICATE_NAME/);
assert.throws(() => buildSkillRegistry(null), /INVALID_SKILL_REGISTRY/);
assert.throws(() => buildSkillRegistry([{ name: 'x', source: 'plugin' }]), /INVALID_SKILL_REGISTRY/);

console.log('skill manifest tests passed');
