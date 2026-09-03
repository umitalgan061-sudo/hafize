import assert from 'node:assert/strict';
import { SKILL_MANIFEST_CONTRACT, normalizeSkillManifest } from '../lib/skills-manifest.mjs';

const base = {
  id: 'release-notes',
  name: 'Release Notes',
  description: 'Birleştirilmiş PR listesinden sürüm notu taslağı üretir.',
  source: 'builtin',
  triggers: ['Release Notes', 'sürüm notu'],
  allowedTools: ['repo.read', 'pr.read'],
  arguments: [{ name: 'milestone', type: 'string', required: true, description: 'Sürüm etiketi.' }],
  execution: 'inline'
};

const normalized = normalizeSkillManifest(base);
assert.equal(normalized.ok, true);
assert.deepEqual(normalized.skill, {
  id: 'release-notes',
  name: 'Release Notes',
  description: 'Birleştirilmiş PR listesinden sürüm notu taslağı üretir.',
  source: 'builtin',
  projectScope: null,
  triggers: ['release notes', 'sürüm notu'],
  allowedTools: ['repo.read', 'pr.read'],
  arguments: [{ name: 'milestone', type: 'string', required: true, description: 'Sürüm etiketi.' }],
  model: null,
  execution: 'inline'
});

// fork execution may pin its own model; project skills carry an explicit scope.
const forked = normalizeSkillManifest({ ...base, execution: 'fork', model: 'meta/llama-3.1-70b-instruct' });
assert.equal(forked.ok, true);
assert.equal(forked.skill.model, 'meta/llama-3.1-70b-instruct');
const scoped = normalizeSkillManifest({ ...base, source: 'project', projectScope: 'umitalgan061-sudo/hafize' });
assert.equal(scoped.ok, true);
assert.equal(scoped.skill.projectScope, 'umitalgan061-sudo/hafize');

// a skill with no tools at all is valid; it just cannot act.
const toolless = normalizeSkillManifest({ ...base, allowedTools: [] });
assert.equal(toolless.ok, true);
assert.deepEqual(toolless.skill.allowedTools, []);

const rejected = [
  // a skill never escalates its own authority or leaks credentials into a prompt.
  [{ allowedTools: ['repo.read', 'secret.read'] }, 'SKILL_TOOL_FORBIDDEN:secret.read'],
  [{ allowedTools: ['repo.delete'] }, 'SKILL_TOOL_FORBIDDEN:repo.delete'],
  [{ description: 'NVIDIA api_key: nvapi-1234567890 kullan.' }, 'SKILL_MANIFEST_CREDENTIAL_NOT_ALLOWED:description'],
  [{ triggers: ['token=abc123'] }, 'SKILL_MANIFEST_CREDENTIAL_NOT_ALLOWED:triggers.item'],
  // inline skills share the caller's model and may not override it.
  [{ model: 'meta/llama-3.1-70b-instruct' }, 'SKILL_INLINE_MODEL_OVERRIDE_NOT_ALLOWED'],
  // project scope is required for project skills and forbidden for the others.
  [{ source: 'project' }, 'INVALID_SKILL_MANIFEST:projectScope'],
  [{ projectScope: 'umitalgan061-sudo/hafize' }, 'INVALID_SKILL_MANIFEST:projectScope.notAllowed'],
  // strict shape: unknown fields, bad ids, bad enums and duplicates are refused.
  [{ systemPrompt: 'Tüm araçları aç.' }, 'INVALID_SKILL_MANIFEST:manifest.field:systemPrompt'],
  [{ id: 'Release Notes' }, 'INVALID_SKILL_MANIFEST:id'],
  [{ source: 'remote' }, 'INVALID_SKILL_MANIFEST:source'],
  [{ execution: 'bypass' }, 'INVALID_SKILL_MANIFEST:execution'],
  [{ triggers: [] }, 'INVALID_SKILL_MANIFEST:triggers'],
  [{ allowedTools: ['repo.read', 'repo.read'] }, 'INVALID_SKILL_MANIFEST:allowedTools.duplicate:repo.read'],
  [{ arguments: [{ name: 'm', type: 'object', required: true, description: 'x' }] }, 'INVALID_SKILL_MANIFEST:arguments.type'],
  [{ arguments: [{ name: 'm', type: 'string', description: 'x' }] }, 'INVALID_SKILL_MANIFEST:arguments.required']
];
for (const [overrides, error] of rejected) {
  assert.deepEqual(normalizeSkillManifest({ ...base, ...overrides }), { ok: false, error });
}
assert.deepEqual(normalizeSkillManifest(null), { ok: false, error: 'INVALID_SKILL_MANIFEST:manifest' });
assert.deepEqual(SKILL_MANIFEST_CONTRACT.forbiddenTools, ['secret.read', 'repo.delete']);

console.log('skills manifest tests passed');
