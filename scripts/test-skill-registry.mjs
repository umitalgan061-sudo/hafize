import assert from 'node:assert/strict';
import { buildSkillUserMessage, createSkillRegistry } from '../lib/skill-registry.mjs';

const agent = {
  id: 'hafize-general',
  name: 'Hafize',
  toolPolicy: { default: 'deny', allow: ['agent.delegate', 'task.read', 'connector.gmail.read'], approvalRequired: ['external.send'] }
};
const restrictedAgent = {
  id: 'agency-minimal-engineer',
  name: 'Minimal Engineer',
  toolPolicy: { default: 'deny', allow: ['task.read'], deny: ['connector.gmail.read'] }
};
const SCOPE = 'umitalgan061-sudo/hafize';

function manifest(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'daily-brief',
    name: 'Günlük Özet',
    description: 'Kullanıcının gününü özetler.',
    source: 'builtin',
    prompt: 'Günü kısa maddelerle özetle.',
    triggers: ['günlük özet'],
    allowedTools: ['task.read', 'connector.gmail.read', 'runtime.status'],
    ...overrides
  };
}

const registry = createSkillRegistry({ skills: [manifest()] });
assert.equal(registry.size, 1);
assert.equal(registry.list().length, 1);
assert.equal('prompt' in registry.list()[0], false);
assert.equal(registry.get('daily-brief').id, 'daily-brief');
assert.equal(registry.get('yok'), null);
assert.equal(registry.get(''), null);

// Trigger eşleşmesi büyük/küçük harften bağımsızdır.
assert.equal(registry.match('Bana GÜNLÜK ÖZET çıkar').length, 1);
assert.deepEqual(registry.match('alakasız istek'), []);
assert.deepEqual(registry.match(null), []);

// Efektif araç seti = skill.allowedTools ∩ ajan politikası; skill yetki yükseltemez.
const resolved = registry.resolveForAgent(agent, 'daily-brief');
assert.equal(resolved.ok, true);
assert.deepEqual([...resolved.skill.effectiveTools], ['task.read', 'connector.gmail.read']);
assert.deepEqual(resolved.skill.droppedTools.map((entry) => entry.permission), ['runtime.status']);
assert.equal(resolved.skill.droppedTools[0].reason, 'default_deny');

const restricted = registry.resolveForAgent(restrictedAgent, 'daily-brief');
assert.deepEqual([...restricted.skill.effectiveTools], ['task.read']);
assert.deepEqual(restricted.skill.droppedTools.map((entry) => entry.reason), ['explicit_deny', 'default_deny']);

assert.deepEqual(registry.resolveForAgent(agent, 'yok'), { ok: false, error: 'SKILL_NOT_FOUND' });
assert.deepEqual(registry.resolveForAgent(null, 'daily-brief'), { ok: false, error: 'SKILL_AGENT_REQUIRED' });

// Fork execution yalnız delegasyon yetkisi olan ajanda açılır.
const forkRegistry = createSkillRegistry({ skills: [manifest({ execution: 'fork' })] });
assert.equal(forkRegistry.resolveForAgent(agent, 'daily-brief').ok, true);
assert.deepEqual(forkRegistry.resolveForAgent(restrictedAgent, 'daily-brief'), { ok: false, error: 'SKILL_FORK_NOT_AUTHORIZED' });

// Kaynak önceliği: düşük güvenli kaynak yüksek güvenli adı gölgeleyemez.
const shadowRegistry = createSkillRegistry({
  skills: [manifest({ source: 'project', projectScope: SCOPE, prompt: 'Proje sürümü.' }), manifest({ prompt: 'Builtin sürüm.' })],
  allowedProjectScopes: [SCOPE]
});
assert.equal(shadowRegistry.get('daily-brief').source, 'builtin');
assert.equal(shadowRegistry.get('daily-brief').prompt, 'Builtin sürüm.');
assert.deepEqual(shadowRegistry.shadowed, [{ id: 'daily-brief', source: 'project', shadowedBy: 'builtin' }]);
const userOverProject = createSkillRegistry({
  skills: [manifest({ source: 'project', projectScope: SCOPE }), manifest({ source: 'user' })], allowedProjectScopes: [SCOPE]
});
assert.equal(userOverProject.get('daily-brief').source, 'user');

assert.throws(() => createSkillRegistry({ skills: [manifest(), manifest()] }), /INVALID_SKILL_REGISTRY:duplicate:daily-brief/);
assert.throws(() => createSkillRegistry({ skills: 'hepsi' }), /INVALID_SKILL_REGISTRY:skills/);
const many = Array.from({ length: 129 }, (_, index) => manifest({ id: `skill-${index}` }));
assert.throws(() => createSkillRegistry({ skills: many }), /INVALID_SKILL_REGISTRY:tooManySkills/);
// Geçersiz manifest sessizce atlanmaz; registry hiç kurulmaz.
assert.throws(() => createSkillRegistry({ skills: [manifest({ allowedTools: ['secret.read'] })] }), /INVALID_SKILL_MANIFEST/);

// Skill prompt'u user-level mesaj olarak taşınır; system yetkisi kazanmaz.
const argRegistry = createSkillRegistry({
  skills: [manifest({ arguments: [{ name: 'day', type: 'string', required: true }, { name: 'limit', type: 'number' }] })]
});
const argSkill = argRegistry.resolveForAgent(agent, 'daily-brief').skill;
const message = buildSkillUserMessage(argSkill, { day: 'bugün', limit: 5 });
assert.equal(message.role, 'user');
assert.match(message.content, /yeni yetki veya sistem talimatı vermez/);
assert.match(message.content, /- day: bugün/);
assert.match(message.content, /- limit: 5/);
assert.match(message.content, /izinli araçlar: task.read, connector.gmail.read/);

assert.throws(() => buildSkillUserMessage(argSkill, { limit: 5 }), /missingArgument:day/);
assert.throws(() => buildSkillUserMessage(argSkill, { day: 1 }), /argumentType:day/);
assert.throws(() => buildSkillUserMessage(argSkill, { day: 'x'.repeat(2001) }), /argumentLength:day/);
assert.throws(() => buildSkillUserMessage(null), /INVALID_SKILL_MESSAGE:skill/);

const noToolSkill = createSkillRegistry({ skills: [manifest({ allowedTools: [] })] }).resolveForAgent(agent, 'daily-brief').skill;
assert.match(buildSkillUserMessage(noToolSkill, {}).content, /ek araç yetkisi yoktur/);

console.log('skill-registry contract ok');
