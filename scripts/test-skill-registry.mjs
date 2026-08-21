import assert from 'node:assert/strict';
import { loadAgentRegistry, resolveAgent } from '../lib/agent-runtime.mjs';
import {
  SKILL_SOURCE_PRIORITY,
  authorizeSkill,
  authorizeSkillTool,
  createSkillRegistry
} from '../lib/skill-registry.mjs';

function manifest(overrides = {}) {
  return {
    name: 'rapor-ozeti',
    description: 'Uzun raporu kısa ve doğrulanabilir bir özete indirger.',
    prompt: 'Raporu oku, önce bulguları sonra riskleri listele.',
    execution: 'inline',
    ...overrides
  };
}

assert.deepEqual(SKILL_SOURCE_PRIORITY, ['builtin', 'user', 'project']);

// Kaynak önceliği: builtin > user > project; düşük öncelik yüksek önceliği gölgeleyemez.
const shadowRegistry = createSkillRegistry({
  builtin: [manifest({ prompt: 'builtin sürümü' })],
  user: [manifest({ prompt: 'user sürümü' }), manifest({ name: 'kod-incele', prompt: 'kullanıcı skilli' })],
  project: [manifest({ prompt: 'project sürümü', projectScope: 'umitalgan061-sudo/hafize' })],
  allowedProjectScopes: ['umitalgan061-sudo/hafize']
});

assert.equal(shadowRegistry.get('rapor-ozeti').source, 'builtin');
assert.equal(shadowRegistry.get('rapor-ozeti').prompt, 'builtin sürümü');
assert.equal(shadowRegistry.get('kod-incele').source, 'user');
assert.deepEqual(shadowRegistry.list().map((skill) => skill.name), ['rapor-ozeti', 'kod-incele']);
assert.deepEqual(
  shadowRegistry.listRejected().map(({ source, reason, name }) => ({ source, reason, name })),
  [
    { source: 'user', reason: 'SHADOWED_BY_HIGHER_PRIORITY_SOURCE', name: 'rapor-ozeti' },
    { source: 'project', reason: 'SHADOWED_BY_HIGHER_PRIORITY_SOURCE', name: 'rapor-ozeti' }
  ]
);
assert.equal(Object.isFrozen(shadowRegistry.list()), true);
assert.equal(shadowRegistry.get('bilinmeyen'), null);
assert.equal(shadowRegistry.get(null), null);

// Aynı kaynak içindeki tekrar ad ayrı bir hata koduyla ayrılır.
const duplicateRegistry = createSkillRegistry({ user: [manifest(), manifest({ prompt: 'ikinci' })] });
assert.equal(duplicateRegistry.list().length, 1);
assert.equal(duplicateRegistry.listRejected()[0].reason, 'DUPLICATE_SKILL_NAME');

// Project skill yalnız açıkça izin verilen kapsamdan yüklenir.
const scopedRegistry = createSkillRegistry({
  project: [
    manifest({ name: 'izinli', projectScope: 'umitalgan061-sudo/hafize' }),
    manifest({ name: 'izinsiz', projectScope: 'baskasi/depo' })
  ],
  allowedProjectScopes: ['umitalgan061-sudo/hafize']
});
assert.deepEqual(scopedRegistry.list().map((skill) => skill.name), ['izinli']);
assert.deepEqual(scopedRegistry.listRejected(), [
  { source: 'project', index: 1, reason: 'PROJECT_SCOPE_NOT_ALLOWED', name: 'izinsiz' }
]);
assert.equal(createSkillRegistry({ project: [manifest({ name: 'izinli', projectScope: 'x/y' })] }).list().length, 0);
for (const allowedProjectScopes of ['x/y', [''], [42], [{}]]) {
  assert.throws(() => createSkillRegistry({ allowedProjectScopes }), /INVALID_SKILL_PROJECT_SCOPES/);
}

// Geçersiz manifest registry'yi bozmaz; hata kodu ile kayda geçer.
const mixedRegistry = createSkillRegistry({
  user: [
    manifest({ name: 'Gecersiz' }),
    { ...manifest({ name: 'sizinti' }), prompt: 'api_key=abc123 kullan' },
    manifest({ name: 'saglam' })
  ]
});
assert.deepEqual(mixedRegistry.list().map((skill) => skill.name), ['saglam']);
assert.deepEqual(mixedRegistry.listRejected().map((entry) => entry.reason), [
  'INVALID_SKILL_NAME',
  'SKILL_SECRET_REJECTED'
]);
assert.equal(mixedRegistry.listRejected().every((entry) => entry.name === null || typeof entry.name === 'string'), true);
assert.equal(JSON.stringify(mixedRegistry.listRejected()).includes('api_key'), false);

for (const source of ['builtin', 'user', 'project']) {
  assert.throws(() => createSkillRegistry({ [source]: 'metin' }), new RegExp(`INVALID_SKILL_SOURCE_LIST:${source}`));
  assert.throws(
    () => createSkillRegistry({ [source]: Array.from({ length: 65 }, () => manifest()) }),
    new RegExp(`INVALID_SKILL_SOURCE_LIST:${source}`)
  );
}
assert.equal(createSkillRegistry().list().length, 0);

// Tetikleyici eşleşmesi tam ve küçük harfe indirgenmiş metin üzerinden çalışır.
const triggerRegistry = createSkillRegistry({ user: [manifest({ triggers: ['Rapor Özeti'] })] });
assert.equal(triggerRegistry.matchTrigger('  rapor özeti '), triggerRegistry.get('rapor-ozeti'));
assert.equal(triggerRegistry.matchTrigger('Rapor Özeti'), triggerRegistry.get('rapor-ozeti'));
assert.equal(triggerRegistry.matchTrigger('rapor'), null);
assert.equal(triggerRegistry.matchTrigger(''), null);
assert.equal(triggerRegistry.matchTrigger(null), null);

// Skill yetki kaynağı değildir: agent policy'sinin vermediği izin skill ile kazanılamaz.
const registry = await loadAgentRegistry();
const hafize = resolveAgent(registry, 'hafize-general');
const narrowed = manifest({ allowedTools: ['runtime.status'] });
const openSkill = manifest({ allowedTools: [] });

assert.deepEqual(authorizeSkillTool(hafize, narrowed, 'runtime.status'), { allowed: true, reason: 'allowlisted' });
assert.deepEqual(authorizeSkillTool(hafize, narrowed, 'agent.delegate'), { allowed: false, reason: 'skill_scope_denied' });
assert.deepEqual(authorizeSkillTool(hafize, narrowed, 'repo.read'), { allowed: false, reason: 'default_deny' });
assert.deepEqual(authorizeSkillTool(hafize, openSkill, 'agent.delegate'), { allowed: true, reason: 'allowlisted' });
assert.deepEqual(authorizeSkillTool(hafize, openSkill, 'repo.delete'), { allowed: false, reason: 'default_deny' });
assert.deepEqual(authorizeSkillTool(hafize, openSkill, '  '), { allowed: false, reason: 'invalid_tool' });
for (const skill of [null, 'metin', {}, { allowedTools: 'runtime.status' }]) {
  assert.deepEqual(authorizeSkillTool(hafize, skill, 'runtime.status'), { allowed: false, reason: 'invalid_skill' });
}

// Onay gerektiren izin skill üzerinden otomatik onaylanmaz.
const approvalSkill = { ...manifest(), allowedTools: ['external.send'] };
assert.deepEqual(authorizeSkillTool(hafize, approvalSkill, 'external.send'), {
  allowed: false,
  reason: 'approval_required'
});
assert.deepEqual(authorizeSkillTool(hafize, approvalSkill, 'external.send', { approvalGranted: true }), {
  allowed: true,
  reason: 'approved'
});

// Çalıştırılabilirlik: skill'in bildirdiği tüm araçlar agent policy'si tarafından karşılanmalıdır.
assert.deepEqual(authorizeSkill(hafize, narrowed), { allowed: true, reason: 'allowlisted' });
assert.deepEqual(authorizeSkill(hafize, openSkill), { allowed: true, reason: 'no_tool_requirement' });
assert.deepEqual(authorizeSkill(hafize, { ...manifest(), allowedTools: ['runtime.status', 'repo.read'] }), {
  allowed: false,
  reason: 'default_deny'
});
assert.deepEqual(authorizeSkill(hafize, null), { allowed: false, reason: 'invalid_skill' });
assert.deepEqual(authorizeSkill(null, openSkill), { allowed: false, reason: 'invalid_agent' });

const agentRegistry = createSkillRegistry({
  builtin: [
    manifest({ name: 'durum-ozeti', allowedTools: ['runtime.status'] }),
    manifest({ name: 'depo-okuma', allowedTools: ['repo.read'] }),
    manifest({ name: 'serbest' })
  ]
});
assert.deepEqual(agentRegistry.listForAgent(hafize).map((skill) => skill.name), ['durum-ozeti', 'serbest']);
assert.equal(Object.isFrozen(agentRegistry.listForAgent(hafize)), true);
assert.deepEqual(agentRegistry.listForAgent(null).map((skill) => skill.name), []);

console.log('skill registry tests passed');
