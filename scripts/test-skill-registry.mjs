import assert from 'node:assert/strict';
import { loadAgentRegistry, resolveAgent } from '../lib/agent-runtime.mjs';
import { buildSkillRegistry, listPublicSkills, resolveSkillForAgent } from '../lib/skill-registry.mjs';

const agentRegistry = await loadAgentRegistry();
const hafize = resolveAgent(agentRegistry, 'hafize-general');
assert.ok(hafize);

function manifest(overrides) {
  return {
    id: 'ozet',
    name: 'Özet',
    description: 'Uzun içeriği kısa özete indirger.',
    source: 'builtin',
    allowedTools: ['runtime.status'],
    prompt: 'İçeriği maddeler halinde özetle.',
    ...overrides
  };
}

// Geçersiz manifest kayıt dışı kalır, geçerli olanlar yüklenir.
const registry = buildSkillRegistry(
  [
    manifest({}),
    manifest({ id: 'delege', source: 'user', allowedTools: ['agent.delegate', 'external.write'] }),
    manifest({ id: 'proje-notu', source: 'project', projectScope: 'apps/hafize' }),
    manifest({ id: 'kapsam-disi', source: 'project', projectScope: 'apps/gizli' }),
    manifest({ id: 'BOZUK' })
  ],
  { allowedProjectScopes: ['apps/hafize'] }
);

assert.deepEqual(registry.skills.map((skill) => skill.id), ['delege', 'ozet', 'proje-notu']);
assert.deepEqual(
  registry.rejected,
  [
    { id: 'kapsam-disi', reason: 'project_scope_not_allowed' },
    { id: 'BOZUK', reason: 'id' }
  ]
);

// Project skill güvenilir kaynağı gölgeleyemez; sıra fark etmez.
for (const manifests of [
  [manifest({ id: 'ozet', source: 'builtin' }), manifest({ id: 'ozet', source: 'project', projectScope: 'apps/hafize', name: 'Sahte' })],
  [manifest({ id: 'ozet', source: 'project', projectScope: 'apps/hafize', name: 'Sahte' }), manifest({ id: 'ozet', source: 'builtin' })]
]) {
  const shadow = buildSkillRegistry(manifests, { allowedProjectScopes: ['apps/hafize'] });
  assert.equal(shadow.skills.length, 1);
  assert.equal(shadow.skills[0].source, 'builtin');
  assert.deepEqual(shadow.rejected, [{ id: 'ozet', reason: 'shadowed_by_trusted_source' }]);
}

// Public liste prompt veya tool yetkisi sızdırmaz.
const publicSkills = listPublicSkills(registry);
assert.deepEqual(Object.keys(publicSkills[0]).sort(), ['description', 'execution', 'id', 'name', 'source', 'triggers']);
assert.equal(JSON.stringify(publicSkills).includes('özetle'), false);

// Skill kendi tool yetkisini yükseltemez: yalnız ajanın izinli araçları kalır.
const delege = resolveSkillForAgent(registry, 'delege', hafize);
assert.equal(delege.ok, true);
assert.deepEqual([...delege.skill.grantedTools], ['agent.delegate']);
assert.deepEqual([...delege.skill.deniedTools], [{ tool: 'external.write', reason: 'approval_required' }]);

// Onay verildiğinde approval-required araç inline skill için açılır.
const approved = resolveSkillForAgent(registry, 'delege', hafize, { approvalGranted: true });
assert.deepEqual([...approved.skill.grantedTools], ['agent.delegate', 'external.write']);
assert.equal(approved.skill.approvalGranted, true);

// Fork execution parent onayını miras almaz.
const forkRegistry = buildSkillRegistry([
  manifest({ id: 'fork-delege', source: 'user', execution: 'fork', allowedTools: ['agent.delegate', 'external.write'] })
]);
const forked = resolveSkillForAgent(forkRegistry, 'fork-delege', hafize, { approvalGranted: true });
assert.equal(forked.skill.approvalGranted, false);
assert.deepEqual([...forked.skill.grantedTools], ['agent.delegate']);
assert.deepEqual([...forked.skill.deniedTools], [{ tool: 'external.write', reason: 'approval_required' }]);

assert.deepEqual(resolveSkillForAgent(registry, 'yok', hafize), { ok: false, error: 'SKILL_NOT_FOUND' });
assert.deepEqual(resolveSkillForAgent(registry, null, hafize), { ok: false, error: 'SKILL_NOT_FOUND' });
assert.deepEqual(resolveSkillForAgent(registry, 'ozet', null), { ok: false, error: 'SKILL_AGENT_REQUIRED' });
assert.throws(() => buildSkillRegistry(null), /INVALID_SKILL_REGISTRY:manifests/);
assert.throws(() => buildSkillRegistry([], { allowedProjectScopes: 'apps/hafize' }), /INVALID_SKILL_REGISTRY:allowedProjectScopes/);

console.log('skill registry tests passed');
