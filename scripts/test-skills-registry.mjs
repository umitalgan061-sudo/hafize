import assert from 'node:assert/strict';
import {
  SKILL_LIMITS,
  buildSkillExecutionPlan,
  createSkillsRegistry,
  normalizeSkillManifest
} from '../lib/skills-registry.mjs';

const hostPermissions = ['repo.read', 'runtime.status', 'trace.write', 'connector.gmail.read'];
const allowedProjectScopes = ['hafize/docs'];

const baseManifest = {
  id: 'release-notes',
  name: 'Sürüm notu yazarı',
  description: 'Birleştirilen PR listesinden Türkçe sürüm notu üretir.',
  source: 'builtin',
  execution: 'inline',
  triggers: ['sürüm notu', 'Release Notes'],
  tools: ['repo.read', 'trace.write'],
  arguments: [{ name: 'sinceTag', type: 'string', required: true, description: 'Başlangıç etiketi' }],
  model: 'nvidia/llama-3.1-nemotron-70b-instruct',
  prompt: 'Verilen PR listesini kullanıcıya uygun kısa bir sürüm notuna dönüştür.'
};

const skill = normalizeSkillManifest(baseManifest, { hostPermissions, allowedProjectScopes });
assert.equal(Object.isFrozen(skill), true);
assert.equal(Object.isFrozen(skill.tools), true);
assert.equal(Object.isFrozen(skill.arguments[0]), true);
assert.deepEqual(skill.triggers, ['sürüm notu', 'release notes']);
assert.deepEqual(skill.arguments, [
  { name: 'sinceTag', type: 'string', required: true, description: 'Başlangıç etiketi' }
]);
assert.equal(skill.projectScope, null);
assert.equal(skill.model, 'nvidia/llama-3.1-nemotron-70b-instruct');

// Optional fields default to empty rather than to implicit authority.
const minimal = normalizeSkillManifest(
  { ...baseManifest, tools: undefined, arguments: undefined, model: undefined },
  { hostPermissions }
);
assert.deepEqual(minimal.tools, []);
assert.deepEqual(minimal.arguments, []);
assert.equal(minimal.model, null);

// A skill can only narrow the host agent's authority, never widen it.
assert.throws(() => normalizeSkillManifest({ ...baseManifest, tools: ['repo.write_branch'] }, { hostPermissions }), /SKILL_PERMISSION_APPROVAL_ONLY:repo.write_branch/);
for (const forbidden of ['secret.read', 'repo.delete']) {
  assert.throws(
    () => normalizeSkillManifest({ ...baseManifest, tools: [forbidden] }, { hostPermissions }),
    /SKILL_PERMISSION_FORBIDDEN/
  );
}
assert.throws(() => normalizeSkillManifest({ ...baseManifest, tools: ['connector.canva.read'] }, { hostPermissions }), /SKILL_PERMISSION_ESCALATION:connector.canva.read/);
assert.throws(() => normalizeSkillManifest(baseManifest, { hostPermissions: [] }), /SKILL_PERMISSION_ESCALATION/);

// Skill prompts stay credential free.
for (const prompt of [
  'Anahtarı process.env.NVIDIA_API_KEY üzerinden oku.',
  'Authorization: Bearer sk-live-abcdefghijklmnop kullan.',
  'api_key: nvapi-0123456789abcdefghij',
  'Şu token ile bağlan: ghp_0123456789abcdefghij',
  '-----BEGIN RSA PRIVATE KEY-----'
]) {
  assert.throws(
    () => normalizeSkillManifest({ ...baseManifest, prompt }, { hostPermissions }),
    /SKILL_PROMPT_SECRET_SUSPECTED/
  );
}

// Project skills load only from explicitly allowed scopes.
const projectManifest = { ...baseManifest, source: 'project', projectScope: 'hafize/docs' };
assert.equal(
  normalizeSkillManifest(projectManifest, { hostPermissions, allowedProjectScopes }).projectScope,
  'hafize/docs'
);
assert.throws(() => normalizeSkillManifest({ ...projectManifest, projectScope: 'other/repo' }, { hostPermissions, allowedProjectScopes }), /SKILL_PROJECT_SCOPE_DENIED/);
for (const projectScope of [undefined, '../escape', 'hafize/../etc']) {
  assert.throws(
    () => normalizeSkillManifest({ ...projectManifest, projectScope }, { hostPermissions, allowedProjectScopes }),
    /INVALID_SKILL_MANIFEST:projectScope|SKILL_PROJECT_SCOPE_DENIED/
  );
}
assert.throws(() => normalizeSkillManifest({ ...baseManifest, projectScope: 'hafize/docs' }, { hostPermissions, allowedProjectScopes }), /INVALID_SKILL_MANIFEST:projectScope/);

// Strict manifest shape: unknown fields and malformed values are rejected.
for (const field of ['systemPrompt', 'permissions', 'apiKey', 'exec', 'toolPolicy']) {
  assert.throws(
    () => normalizeSkillManifest({ ...baseManifest, [field]: 'x' }, { hostPermissions }),
    new RegExp(`INVALID_SKILL_MANIFEST:manifest.${field}`)
  );
}
for (const patch of [
  { id: 'Release Notes' },
  { id: 'a' },
  { source: 'remote' },
  { execution: 'bypass' },
  { execution: '' },
  { triggers: [] },
  { triggers: ['x'] },
  { triggers: ['tekrar', 'Tekrar'] },
  { triggers: Array.from({ length: SKILL_LIMITS.maxTriggers + 1 }, (_, index) => `tetik-${index}`) },
  { tools: ['REPO.READ'] },
  { tools: ['repo.read', 'repo.read'] },
  { arguments: [{ name: 'a b', type: 'string' }] },
  { arguments: [{ name: 'ok', type: 'object' }] },
  { arguments: [{ name: 'ok', type: 'string', extra: 1 }] },
  { arguments: [{ name: 'ok', type: 'string', required: 'yes' }] },
  { model: 'nvidia/model?token=abc' },
  { prompt: 'kısa' },
  { prompt: 'x'.repeat(SKILL_LIMITS.maxPromptLength + 1) },
  { name: '' }
]) {
  assert.throws(
    () => normalizeSkillManifest({ ...baseManifest, ...patch }, { hostPermissions, allowedProjectScopes }),
    /INVALID_SKILL_MANIFEST|SKILL_PERMISSION/
  );
}
for (const input of [null, [], 'skill', 42]) {
  assert.throws(() => normalizeSkillManifest(input, { hostPermissions }), /INVALID_SKILL_MANIFEST:manifest/);
}

// Registry: trusted sources win, invalid manifests are isolated.
const registry = createSkillsRegistry({
  hostPermissions,
  allowedProjectScopes,
  manifests: [
    baseManifest,
    { ...baseManifest, source: 'user', name: 'Kullanıcı sürümü' },
    { ...baseManifest, id: 'inbox-triage', source: 'user', execution: 'fork', triggers: ['gelen kutusu'], tools: ['connector.gmail.read'] },
    { ...baseManifest, id: 'escalating-skill', source: 'project', projectScope: 'hafize/docs', tools: ['secret.read'] },
    { id: 'broken', source: 'user' }
  ]
});
assert.deepEqual(registry.list.map((entry) => entry.id), ['release-notes', 'inbox-triage']);
assert.equal(registry.get('release-notes').source, 'builtin');
assert.equal(registry.get('release-notes').name, 'Sürüm notu yazarı');
assert.deepEqual(registry.shadowed, [{ id: 'release-notes', source: 'user' }]);
assert.deepEqual(registry.rejected, [
  { id: 'escalating-skill', source: 'project', reason: 'SKILL_PERMISSION_FORBIDDEN:secret.read' },
  { id: 'broken', source: 'user', reason: 'INVALID_SKILL_MANIFEST:name' }
]);
assert.equal(registry.get('missing'), null);
assert.equal(registry.get(null), null);
assert.deepEqual(registry.listPublic()[1], {
  id: 'inbox-triage',
  name: 'Sürüm notu yazarı',
  description: baseManifest.description,
  source: 'user',
  execution: 'fork'
});
assert.equal(JSON.stringify(registry.listPublic()).includes('prompt'), false);

// A less trusted source registered first still loses to the trusted one.
const reordered = createSkillsRegistry({
  hostPermissions,
  allowedProjectScopes,
  manifests: [{ ...baseManifest, source: 'project', projectScope: 'hafize/docs' }, baseManifest]
});
assert.equal(reordered.list.length, 1);
assert.equal(reordered.get('release-notes').source, 'builtin');
assert.deepEqual(reordered.shadowed, [{ id: 'release-notes', source: 'project' }]);

// Trigger matching is case and locale aware, and never matches on empty input.
assert.deepEqual(registry.match('Bana SÜRÜM NOTU hazırla').map((entry) => entry.id), ['release-notes']);
assert.deepEqual(registry.match('release notes lütfen').map((entry) => entry.id), ['release-notes']);
assert.deepEqual(registry.match('gelen kutusu özeti').map((entry) => entry.id), ['inbox-triage']);
for (const input of ['', '   ', null, undefined, 42]) assert.deepEqual(registry.match(input), []);

// Execution plans stay bounded and never inherit host authority implicitly.
const inlinePlan = buildSkillExecutionPlan(registry.get('release-notes'), { hostPermissions, traceId: 'trace-1' });
assert.deepEqual(inlinePlan, {
  skillId: 'release-notes',
  execution: 'inline',
  traceId: 'trace-1',
  isolated: false,
  inheritsHostTools: false,
  permissions: ['repo.read', 'trace.write'],
  model: baseManifest.model,
  prompt: baseManifest.prompt
});
assert.equal(Object.isFrozen(inlinePlan), true);
assert.equal(buildSkillExecutionPlan(registry.get('inbox-triage'), { hostPermissions, traceId: 'trace-1' }).isolated, true);
assert.throws(
  () => buildSkillExecutionPlan(registry.get('release-notes'), { hostPermissions: ['trace.write'], traceId: 'trace-1' }),
  /SKILL_PERMISSION_ESCALATION:repo.read/
);
for (const traceId of [undefined, '', 'x'.repeat(129)]) {
  assert.throws(
    () => buildSkillExecutionPlan(registry.get('release-notes'), { hostPermissions, traceId }),
    /INVALID_SKILL_MANIFEST:traceId/
  );
}
for (const badSkill of [null, {}, { id: 'x', execution: 'bypass' }]) {
  assert.throws(() => buildSkillExecutionPlan(badSkill, { hostPermissions, traceId: 'trace-1' }), /INVALID_SKILL_MANIFEST:skill/);
}

console.log('skills registry tests passed');
