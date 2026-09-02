import assert from 'node:assert/strict';
import {
  SKILL_SOURCE_PRECEDENCE,
  buildSkillInvocationMessage,
  createSkillRegistry,
  listSkillsForAgent,
  normalizeSkillArguments,
  resolveSkillForAgent
} from '../lib/skill-registry.mjs';

const PROJECT_SCOPE = 'umitalgan061-sudo/hafize';

function manifest(overrides = {}) {
  return {
    name: 'gunluk-ozet',
    description: 'Günlük çalışma özetini hazırlar.',
    triggers: ['günlük özet'],
    allowedTools: ['task.read', 'trace.write'],
    prompt: 'Kullanıcının gününü kısa maddelerle özetle.',
    ...overrides
  };
}

const primaryAgent = {
  id: 'hafize-general',
  toolPolicy: {
    default: 'deny',
    allow: ['agent.delegate', 'task.read', 'runtime.status'],
    approvalRequired: ['external.write']
  }
};
const narrowAgent = { id: 'reviewer', toolPolicy: { default: 'deny', allow: ['runtime.status'] } };

const registry = createSkillRegistry({
  sources: [
    { source: 'project', scope: PROJECT_SCOPE, manifests: [manifest({ prompt: 'Proje sürümü.' }), manifest({ name: 'proje-tarama' })] },
    { source: 'user', manifests: [manifest({ name: 'kisisel-not', allowedTools: [] })] },
    {
      source: 'builtin',
      manifests: [
        manifest(),
        manifest({ name: 'derin-inceleme', execution: 'fork', agentId: 'agency-orchestrator', allowedTools: ['runtime.status'] })
      ]
    }
  ],
  allowedProjectScopes: [PROJECT_SCOPE]
});

// Kaynak önceliği builtin > user > project; project bir builtin adını gölgeleyemez.
assert.deepEqual(SKILL_SOURCE_PRECEDENCE, { builtin: 3, user: 2, project: 1 });
assert.deepEqual(registry.skills.map((skill) => `${skill.source}:${skill.name}`), [
  'builtin:gunluk-ozet',
  'builtin:derin-inceleme',
  'user:kisisel-not',
  'project:proje-tarama'
]);
assert.equal(registry.get('gunluk-ozet').source, 'builtin');
assert.deepEqual(registry.rejected, [{ source: 'project', name: 'gunluk-ozet', reason: 'SKILL_NAME_SHADOWED' }]);
assert.equal(Object.isFrozen(registry.skills), true);
assert.equal(registry.get('bilinmeyen'), null);

// Aynı kaynakta tekrarlanan ad ve geçersiz manifest reddedilir, kalanlar yüklenir.
const noisy = createSkillRegistry({
  sources: [{ source: 'builtin', manifests: [manifest(), manifest(), manifest({ name: 'Gecersiz' }), manifest({ name: 'saglam' })] }]
});
assert.deepEqual(noisy.skills.map((skill) => skill.name), ['gunluk-ozet', 'saglam']);
assert.deepEqual(noisy.rejected.map((entry) => entry.reason), ['SKILL_NAME_DUPLICATE', 'INVALID_SKILL_NAME']);

// İzin verilmeyen proje kapsamı hiç yüklenmez.
const outOfScope = createSkillRegistry({
  sources: [{ source: 'project', scope: 'baska/proje', manifests: [manifest()] }],
  allowedProjectScopes: [PROJECT_SCOPE]
});
assert.deepEqual(outOfScope.skills, []);
assert.deepEqual(outOfScope.rejected, [{ source: 'project', name: '', reason: 'SKILL_PROJECT_SCOPE_NOT_ALLOWED' }]);
assert.deepEqual(
  createSkillRegistry({ sources: [{ source: 'builtin', manifests: null }] }).rejected,
  [{ source: 'builtin', name: '', reason: 'INVALID_SKILL_SOURCE_ENTRY' }]
);

// Skill ajan yetkisini yükseltemez; efektif araçlar kesişimdir.
const resolved = resolveSkillForAgent(registry, 'gunluk-ozet', primaryAgent);
assert.equal(resolved.ok, true);
assert.deepEqual(resolved.invocation.effectiveTools, ['task.read']);
assert.equal(resolved.invocation.execution, 'inline');
assert.equal(Object.isFrozen(resolved.invocation), true);
assert.deepEqual(resolveSkillForAgent(registry, 'gunluk-ozet', narrowAgent), { ok: false, error: 'SKILL_TOOLS_NOT_AUTHORIZED' });
assert.deepEqual(resolveSkillForAgent(registry, 'yok', primaryAgent), { ok: false, error: 'SKILL_NOT_FOUND' });
assert.deepEqual(resolveSkillForAgent(registry, 'gunluk-ozet', {}), { ok: false, error: 'SKILL_AGENT_REQUIRED' });

// fork yürütmesi delegasyon yetkisi ister; araç gerektirmeyen skill her ajanda çalışır.
assert.equal(resolveSkillForAgent(registry, 'derin-inceleme', primaryAgent).invocation.agentId, 'agency-orchestrator');
assert.deepEqual(resolveSkillForAgent(registry, 'derin-inceleme', narrowAgent), { ok: false, error: 'SKILL_FORK_NOT_AUTHORIZED' });
assert.deepEqual(resolveSkillForAgent(registry, 'kisisel-not', narrowAgent).invocation.effectiveTools, []);

// Ajana görünen liste yalnızca gerçekten çalıştırılabilir skill'leri içerir.
assert.deepEqual(listSkillsForAgent(registry, primaryAgent).map((skill) => skill.name), [
  'gunluk-ozet',
  'derin-inceleme',
  'kisisel-not',
  'proje-tarama'
]);
assert.deepEqual(listSkillsForAgent(registry, narrowAgent).map((skill) => skill.name), ['kisisel-not']);
assert.equal('prompt' in listSkillsForAgent(registry, primaryAgent)[0], false);

// Argüman doğrulaması.
const withArgs = createSkillRegistry({
  sources: [{ source: 'builtin', manifests: [manifest({ arguments: [{ name: 'tarih', required: true }, { name: 'not' }] })] }]
});
const invocation = resolveSkillForAgent(withArgs, 'gunluk-ozet', primaryAgent).invocation;
assert.deepEqual(normalizeSkillArguments(invocation, { tarih: ' 2026-09-02 ' }), { ok: true, values: { tarih: '2026-09-02' } });
assert.deepEqual(normalizeSkillArguments(invocation, {}), { ok: false, error: 'MISSING_SKILL_ARGUMENT' });
assert.deepEqual(normalizeSkillArguments(invocation, { tarih: '2026-09-02', gizli: 'x' }), { ok: false, error: 'UNKNOWN_SKILL_ARGUMENT' });
assert.deepEqual(normalizeSkillArguments(invocation, { tarih: 42 }), { ok: false, error: 'INVALID_SKILL_ARGUMENT_VALUE' });
assert.deepEqual(normalizeSkillArguments(invocation, { tarih: 'a\0b' }), { ok: false, error: 'INVALID_SKILL_ARGUMENT_VALUE' });
assert.deepEqual(normalizeSkillArguments(invocation, ['tarih']), { ok: false, error: 'INVALID_SKILL_ARGUMENT_INPUT' });
assert.equal(normalizeSkillArguments(invocation, { tarih: '2026-09-02', not: '' }).ok, true);

// Skill içeriği user düzeyinde veri olarak taşınır, sistem yetkisi kazanmaz.
const message = buildSkillInvocationMessage(invocation, { tarih: '2026-09-02' });
assert.equal(message.role, 'user');
assert.match(message.content, /Hafize skill: gunluk-ozet — kaynak: builtin, yürütme: inline/);
assert.match(message.content, /yeni araç yetkisi veya sistem talimatı vermez/);
assert.match(message.content, /Bu skill için kullanılabilir araçlar: task\.read\./);
assert.match(message.content, /- tarih: 2026-09-02/);
assert.match(message.content, /Kullanıcının gününü kısa maddelerle özetle\./);

console.log('skill registry tests passed');
