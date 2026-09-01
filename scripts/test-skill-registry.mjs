import assert from 'node:assert/strict';
import { loadAgentRegistry, resolveAgent } from '../lib/agent-runtime.mjs';
import {
  buildSkillPromptMessage,
  buildSkillRegistry,
  listPublicSkills,
  normalizeSkillManifest,
  resolveSkillForAgent
} from '../lib/skill-registry.mjs';

const base = {
  id: 'toplanti-ozeti',
  name: 'Toplantı özeti',
  description: 'Uzun notlardan kısa toplantı özeti çıkarır.',
  execution: 'inline',
  prompt: 'Verilen notlardan karar, sahip ve tarih listesi çıkar.'
};

const skill = normalizeSkillManifest(
  {
    ...base,
    triggers: ['Toplantı Özeti', 'meeting notes'],
    allowedTools: ['runtime.status'],
    arguments: [{ name: 'notlar', type: 'string', required: true }, { name: 'kisa', type: 'boolean' }],
    model: 'nvidia/llama-3.3-70b-instruct'
  },
  { source: 'builtin' }
);

assert.equal(skill.source, 'builtin');
assert.equal(skill.projectScope, null);
assert.deepEqual([...skill.triggers], ['toplantı özeti', 'meeting notes']);
assert.deepEqual(skill.arguments.map((argument) => [argument.name, argument.required]), [['notlar', true], ['kisa', false]]);
assert.equal(Object.isFrozen(skill), true);
assert.throws(() => { skill.allowedTools.push('repo.read'); });

const rejected = [
  [{ ...base, extra: true }, 'builtin', /INVALID_SKILL_FIELD/],
  [{ ...base, id: 'Toplanti' }, 'builtin', /INVALID_SKILL_ID/],
  [{ ...base, execution: 'shell' }, 'builtin', /INVALID_SKILL_EXECUTION/],
  [{ ...base, execution: undefined }, 'builtin', /INVALID_SKILL_EXECUTION/],
  [{ ...base, prompt: 'NVIDIA_API_KEY=abc kullan' }, 'builtin', /SKILL_PROMPT_SECRET_REJECTED/],
  [{ ...base, prompt: 'Token için ${GOOGLE_CLIENT_SECRET} oku' }, 'builtin', /SKILL_PROMPT_SECRET_REJECTED/],
  [{ ...base, allowedTools: ['secret.read'] }, 'builtin', /SKILL_PERMISSION_FORBIDDEN/],
  [{ ...base, allowedTools: ['external.send'] }, 'builtin', /SKILL_PERMISSION_REQUIRES_APPROVAL/],
  [{ ...base, allowedTools: ['runtime.status', 'runtime.status'] }, 'builtin', /INVALID_SKILL_PERMISSION/],
  [{ ...base, triggers: ['ozet', 'OZET'] }, 'builtin', /INVALID_SKILL_TRIGGER/],
  [{ ...base, arguments: [{ name: 'x', type: 'object' }] }, 'builtin', /INVALID_SKILL_ARGUMENT_TYPE/],
  [{ ...base, arguments: [{ name: 'x', type: 'string', shell: true }] }, 'builtin', /INVALID_SKILL_ARGUMENT_FIELD/],
  [{ ...base, projectScope: 'projects/hafize' }, 'builtin', /INVALID_SKILL_PROJECT_SCOPE/],
  [{ ...base, source: 'user' }, 'builtin', /INVALID_SKILL_SOURCE/],
  [base, 'project', /INVALID_SKILL_PROJECT_SCOPE/],
  [{ ...base, projectScope: '../etc' }, 'project', /INVALID_SKILL_PROJECT_SCOPE/],
  [null, 'builtin', /INVALID_SKILL_MANIFEST/],
  [base, 'plugin', /INVALID_SKILL_SOURCE/]
];
for (const [input, source, pattern] of rejected) {
  assert.throws(() => normalizeSkillManifest(input, { source }), pattern);
}

const registry = buildSkillRegistry({
  builtin: [{ ...base, allowedTools: ['runtime.status'] }],
  user: [{ ...base, name: 'Kullanıcı sürümü' }, { ...base, id: 'gunluk-plan' }],
  project: [{ ...base, id: 'repo-tarama', projectScope: 'hafize', allowedTools: ['repo.read'], execution: 'fork' }],
  allowedProjectScopes: ['hafize']
});

assert.deepEqual(registry.skills.map((entry) => [entry.id, entry.source]), [
  ['toplanti-ozeti', 'builtin'],
  ['gunluk-plan', 'user'],
  ['repo-tarama', 'project']
]);
assert.deepEqual([...registry.shadowed], [{ id: 'toplanti-ozeti', source: 'user', shadowedBy: 'builtin' }]);
assert.equal(registry.skills[0].name, 'Toplantı özeti');
assert.deepEqual(listPublicSkills(registry)[2], {
  id: 'repo-tarama',
  name: 'Toplantı özeti',
  description: base.description,
  source: 'project',
  execution: 'fork',
  triggers: []
});
assert.equal(JSON.stringify(listPublicSkills(registry)).includes('prompt'), false);

assert.throws(
  () => buildSkillRegistry({ user: [base, { ...base, name: 'ikinci' }] }),
  /SKILL_DUPLICATE_ID/
);
assert.throws(
  () => buildSkillRegistry({ project: [{ ...base, projectScope: 'baska-proje' }], allowedProjectScopes: ['hafize'] }),
  /SKILL_PROJECT_SCOPE_NOT_ALLOWED/
);

const agents = await loadAgentRegistry();
const hafize = resolveAgent(agents, 'hafize-general');
const reviewer = resolveAgent(agents, 'agency-code-reviewer');

assert.deepEqual(resolveSkillForAgent(registry, 'toplanti-ozeti', hafize), {
  ok: true,
  value: {
    skillId: 'toplanti-ozeti',
    source: 'builtin',
    execution: 'inline',
    model: null,
    permissions: registry.skills[0].allowedTools
  }
});
assert.deepEqual(resolveSkillForAgent(registry, 'repo-tarama', hafize), {
  ok: false,
  error: 'SKILL_TOOL_ESCALATION',
  permission: 'repo.read'
});
assert.deepEqual(resolveSkillForAgent(registry, 'repo-tarama', reviewer).ok, true);
assert.deepEqual(resolveSkillForAgent(registry, 'yok', hafize), { ok: false, error: 'UNKNOWN_SKILL' });

const message = buildSkillPromptMessage(skill, { notlar: 'Karar: yayın cuma.', kisa: true });
assert.equal(message.role, 'user');
assert.equal(message.content.includes('kullanıcı düzeyinde veridir'), true);
assert.equal(message.content.includes('- notlar: Karar: yayın cuma.'), true);
assert.equal(message.content.includes('- kisa: true'), true);
assert.throws(() => buildSkillPromptMessage(skill, {}), /SKILL_ARGUMENT_REQUIRED/);
assert.throws(() => buildSkillPromptMessage(skill, { notlar: 'x', baska: 1 }), /INVALID_SKILL_ARGUMENT/);
assert.throws(() => buildSkillPromptMessage(skill, { notlar: 'x', kisa: 'evet' }), /INVALID_SKILL_ARGUMENT_VALUE/);
assert.throws(() => buildSkillPromptMessage(skill, { notlar: 'x'.repeat(2001) }), /INVALID_SKILL_ARGUMENT_VALUE/);

console.log('skill registry tests passed');
