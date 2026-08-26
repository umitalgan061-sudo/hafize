import assert from 'node:assert/strict';
import { loadAgentRegistry } from '../lib/agent-runtime.mjs';
import { authorizeSkillTool, buildSkillRegistry, listPublicSkills, resolveSkill } from '../lib/skill-registry.mjs';

const agentRegistry = await loadAgentRegistry();
const agent = agentRegistry.agents.find((item) => item.id === 'hafize-general');
const agentIds = agentRegistry.agents.map((item) => item.id);
const options = { agent, agentIds, projectScopeAllowed: true };

const manifest = (name, extra = {}) => ({ name, description: `${name} skill'i.`, prompt: 'Görevi çöz.', ...extra });
const rejects = (sources, pattern, opts = options) => assert.throws(() => buildSkillRegistry(sources, opts), pattern);

const registry = buildSkillRegistry(
  {
    builtin: [manifest('durum', { allowedTools: ['runtime.status'] })],
    user: [manifest('durum', { prompt: 'Gölgelenmiş kullanıcı skill.' }), manifest('posta-ozeti')],
    project: [manifest('proje-notu')]
  },
  options
);

// Kaynak önceliği: builtin > user > project; gölgelenen kayıt sessizce düşmez.
assert.equal(registry.agentId, 'hafize-general');
assert.deepEqual(registry.skills.map((skill) => [skill.name, skill.source]), [
  ['durum', 'builtin'],
  ['posta-ozeti', 'user'],
  ['proje-notu', 'project']
]);
assert.deepEqual(registry.shadowed, [{ name: 'durum', source: 'user', shadowedBy: 'builtin' }]);
assert.equal(Object.isFrozen(registry), true);
assert.equal(Object.isFrozen(registry.skills), true);
assert.equal(resolveSkill(registry, ' durum ').source, 'builtin');
assert.equal(resolveSkill(registry, 'yok'), null);
assert.equal(resolveSkill(registry, ''), null);

// Public liste prompt sızdırmaz.
assert.deepEqual(Object.keys(listPublicSkills(registry)[0]), [
  'name',
  'source',
  'description',
  'triggers',
  'executionContext'
]);

// Proje kaynağı açık izin olmadan yüklenmez; builtin etkilenmez.
rejects({ project: [manifest('proje-notu')] }, /SKILL_PROJECT_SOURCE_NOT_ALLOWED/, { agent, agentIds });
assert.equal(buildSkillRegistry({ builtin: [manifest('a-b')] }, { agent, agentIds }).skills.length, 1);

// Skill agent'ın sahip olmadığı yetkiyi bildiremez.
rejects({ builtin: [manifest('yaz', { allowedTools: ['external.write'] })] }, /SKILL_TOOL_ESCALATION/);

// fork hedefi agent registry'de gerçekten bulunmalıdır.
const forkSkill = (forkAgentId) => ({ builtin: [manifest('incele', { executionContext: 'fork', forkAgentId })] });
rejects(forkSkill('sahte-ajan'), /UNKNOWN_SKILL_FORK_AGENT/);
assert.equal(buildSkillRegistry(forkSkill('agency-code-reviewer'), options).skills[0].forkAgentId, 'agency-code-reviewer');

// Registry girdisi ve agent policy sözleşmesi.
for (const sources of [null, [], { plugin: [] }, { builtin: 'x' }]) {
  rejects(sources, /INVALID_SKILL_REGISTRY|INVALID_SKILL_SOURCE/);
}
for (const badAgent of [null, { id: 'x' }, { id: 'x', toolPolicy: { default: 'allow' } }]) {
  rejects({}, /INVALID_SKILL_REGISTRY_AGENT/, { ...options, agent: badAgent });
}

// Tool yetkisi skill bildirimi ile agent policy'sinin kesişimidir.
const statusSkill = resolveSkill(registry, 'durum');
assert.deepEqual(authorizeSkillTool(statusSkill, agent, 'runtime.status'), { allowed: true, reason: 'allowlisted' });
assert.deepEqual(authorizeSkillTool(statusSkill, agent, 'agent.delegate'), { allowed: false, reason: 'not_declared_by_skill' });
assert.deepEqual(authorizeSkillTool(statusSkill, agent, ''), { allowed: false, reason: 'invalid_tool' });
assert.deepEqual(authorizeSkillTool(resolveSkill(registry, 'posta-ozeti'), agent, 'runtime.status'), {
  allowed: false,
  reason: 'not_declared_by_skill'
});

// Agent yetkiyi geri çekerse skill bildirimi tek başına yetmez.
const narrowedAgent = { ...agent, toolPolicy: { ...agent.toolPolicy, allow: [] } };
assert.deepEqual(authorizeSkillTool(statusSkill, narrowedAgent, 'runtime.status'), { allowed: false, reason: 'default_deny' });

// Onay gerektiren yetki skill üzerinden onaysız açılmaz.
const approvalAgent = { ...agent, toolPolicy: { default: 'deny', allow: [], approvalRequired: ['external.write'] } };
const approvalSkill = { name: 'yaz', allowedTools: ['external.write'] };
assert.equal(authorizeSkillTool(approvalSkill, approvalAgent, 'external.write').allowed, false);
assert.equal(authorizeSkillTool(approvalSkill, approvalAgent, 'external.write', { approvalGranted: true }).allowed, true);

console.log('skill registry tests passed');
