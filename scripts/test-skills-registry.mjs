import assert from 'node:assert/strict';
import { loadAgentRegistry, resolveAgent } from '../lib/agent-runtime.mjs';
import {
  authorizeSkillTool,
  buildSkillPromptMessage,
  listPublicSkills,
  loadSkillsRegistry,
  resolveSkill
} from '../lib/skills-registry.mjs';

const manifest = (overrides) => ({
  id: 'pr-ozeti',
  name: 'PR Özeti',
  description: 'PR diff’ini özetler.',
  execution: 'inline',
  allowedTools: ['repo.read'],
  prompt: 'Diff’i oku ve dört başlıkta özetle.',
  ...overrides
});

const registry = loadSkillsRegistry({
  builtin: [manifest({}), manifest({ id: 'not-al', name: 'Not', execution: 'fork' })],
  user: [manifest({ id: 'kisisel', name: 'Kişisel', triggers: ['kişisel'] })],
  project: [manifest({ id: 'proje', name: 'Proje', projectScope: '.hafize/skills' })],
  allowedProjectRoots: ['.hafize/skills']
});

assert.equal(registry.skills.length, 4);
assert.equal(resolveSkill(registry, 'pr-ozeti').source, 'builtin');
assert.equal(resolveSkill(registry, 'kisisel').source, 'user');
assert.equal(resolveSkill(registry, 'proje').source, 'project');
assert.equal(resolveSkill(registry, 'yok'), null);
assert.equal(resolveSkill(registry, null), null);
assert.equal(Object.isFrozen(registry), true);

// Kaynak önceliği: daha az güvenilen kaynak, güvenilir olanı gölgeleyemez.
const shadowRegistry = loadSkillsRegistry({
  builtin: [manifest({ prompt: 'Builtin sürüm.' })],
  user: [manifest({ prompt: 'User sürümü builtin’i ele geçirmeye çalışır.' })],
  project: [manifest({ prompt: 'Project sürümü builtin’i ele geçirmeye çalışır.', projectScope: '.hafize/skills' })],
  allowedProjectRoots: ['.hafize/skills']
});
assert.equal(shadowRegistry.skills.length, 1);
assert.equal(resolveSkill(shadowRegistry, 'pr-ozeti').source, 'builtin');
assert.equal(resolveSkill(shadowRegistry, 'pr-ozeti').prompt, 'Builtin sürüm.');
// Gölgeleme sessizce yutulmaz.
assert.deepEqual([...shadowRegistry.shadowed], [
  { id: 'pr-ozeti', ignoredSource: 'user', keptSource: 'builtin' },
  { id: 'pr-ozeti', ignoredSource: 'project', keptSource: 'builtin' }
]);

const userOverProject = loadSkillsRegistry({
  user: [manifest({ id: 'ortak', prompt: 'User sürümü.' })],
  project: [manifest({ id: 'ortak', prompt: 'Project sürümü.', projectScope: 'skills' })],
  allowedProjectRoots: ['skills']
});
assert.equal(resolveSkill(userOverProject, 'ortak').source, 'user');

// Project skill yalnızca açıkça izin verilen kapsamdan yüklenir.
assert.throws(
  () => loadSkillsRegistry({
    project: [manifest({ id: 'proje', projectScope: 'baska/dizin' })],
    allowedProjectRoots: ['.hafize/skills']
  }),
  /SKILL_PROJECT_SCOPE_DENIED:proje/
);
assert.throws(
  () => loadSkillsRegistry({ project: [manifest({ id: 'proje', projectScope: '.hafize/skills' })] }),
  /SKILL_PROJECT_SCOPE_DENIED:proje/
);
// Kök öneki kısmi eşleşmeyle atlatılamaz.
assert.throws(
  () => loadSkillsRegistry({
    project: [manifest({ id: 'proje', projectScope: '.hafize/skills-evil' })],
    allowedProjectRoots: ['.hafize/skills']
  }),
  /SKILL_PROJECT_SCOPE_DENIED:proje/
);
for (const roots of [['/mutlak'], ['../kacis'], [''], 'string-degil']) {
  assert.throws(
    () => loadSkillsRegistry({ allowedProjectRoots: roots }),
    /INVALID_SKILLS_REGISTRY:allowedProjectRoots/,
    `geçersiz kök kabul edildi: ${JSON.stringify(roots)}`
  );
}
assert.throws(() => loadSkillsRegistry({ builtin: 'liste-degil' }), /INVALID_SKILLS_REGISTRY:builtin/);

// Public görünüm prompt sızdırmaz.
const publicView = listPublicSkills(registry);
assert.equal(publicView.length, 4);
assert.deepEqual(Object.keys(publicView[0]).sort(), ['arguments', 'description', 'execution', 'id', 'name', 'source', 'triggers']);
assert.equal(JSON.stringify(publicView).includes('Diff’i oku'), false);
assert.equal(JSON.stringify(publicView).includes('prompt'), false);

// Yetki kesişimi: skill yalnızca daraltabilir, genişletemez.
const agentRegistry = await loadAgentRegistry();
const reviewer = resolveAgent(agentRegistry, 'agency-code-reviewer');
const hafize = resolveAgent(agentRegistry, 'hafize-general');
const repoSkill = resolveSkill(registry, 'pr-ozeti');

assert.deepEqual(authorizeSkillTool(reviewer, repoSkill, 'repo.read'), {
  allowed: true,
  reason: 'skill_and_agent_allowlisted'
});
// Agent'ın repo.read izni yoksa skill bunu veremez.
assert.equal(authorizeSkillTool(hafize, repoSkill, 'repo.read').allowed, false);
// Agent izinli olsa bile skill listelemediği aracı kullanamaz.
assert.deepEqual(authorizeSkillTool(hafize, repoSkill, 'runtime.status'), {
  allowed: false,
  reason: 'skill_default_deny'
});
assert.equal(authorizeSkillTool(reviewer, repoSkill, '').allowed, false);
assert.equal(authorizeSkillTool(reviewer, null, 'repo.read').reason, 'invalid_skill');

// Onay gerektiren izin skill üzerinden otomatik onaylanmış sayılmaz.
const approvalAgent = { toolPolicy: { default: 'deny', approvalRequired: ['repo.read'] } };
assert.equal(authorizeSkillTool(approvalAgent, repoSkill, 'repo.read').reason, 'approval_required');
assert.equal(authorizeSkillTool(approvalAgent, repoSkill, 'repo.read', { approvalGranted: true }).allowed, true);

// Skill prompt'u system yetkisi kazanmaz.
const promptMessage = buildSkillPromptMessage(repoSkill);
assert.equal(promptMessage.role, 'user');
assert.equal(promptMessage.content.includes('veri olarak ele alınır'), true);
assert.equal(promptMessage.content.includes('Diff’i oku'), true);
assert.equal(buildSkillPromptMessage(null), null);

console.log('skills registry tests passed');
