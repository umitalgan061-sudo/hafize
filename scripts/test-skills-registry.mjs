import assert from 'node:assert/strict';
import { buildSkillRegistry } from '../lib/skills-registry.mjs';

const agent = { id: 'hafize-general', toolPolicy: { default: 'deny', allow: ['agent.delegate', 'runtime.status'] } };
const manifest = (name, triggers = []) => ({ name, description: `${name} açıklaması.`, triggers, prompt: `${name} için yanıt üret.` });

const registry = buildSkillRegistry(
  [
    { source: 'user', manifest: manifest('gunluk-ozet', ['Günlük özet']) },
    { source: 'builtin', manifest: manifest('durum-raporu', ['durum raporu']) },
    { source: 'project', projectScope: 'umitalgan061-sudo/hafize', manifest: manifest('repo-notu', ['repo notu']) }
  ],
  { agent, allowedProjectScopes: ['umitalgan061-sudo/hafize'] }
);

// Güven sırasına göre deterministik sıralama.
assert.deepEqual(registry.skills.map((skill) => skill.name), ['durum-raporu', 'gunluk-ozet', 'repo-notu']);
assert.deepEqual(registry.shadowed, []);
assert.equal(Object.isFrozen(registry), true);
assert.equal(Object.isFrozen(registry.skills), true);
assert.equal(registry.get('gunluk-ozet').source, 'user');
assert.equal(registry.get(' durum-raporu ').source, 'builtin');
assert.equal(registry.get('yok'), null);
assert.equal(registry.get(null), null);

// Modele sunulan özet prompt veya izin bilgisi sızdırmaz.
const publicList = registry.listPublic();
assert.deepEqual(publicList[0], { name: 'durum-raporu', description: 'durum-raporu açıklaması.', source: 'builtin', execution: 'inline' });
assert.equal(JSON.stringify(publicList).includes('yanıt üret'), false);
assert.equal(JSON.stringify(publicList).includes('allowedTools'), false);

// Tetikleyici eşleşmesi küçük/büyük harften bağımsızdır.
assert.deepEqual(registry.match('Bugün GÜNLÜK ÖZET istiyorum').map((skill) => skill.name), ['gunluk-ozet']);
assert.deepEqual(registry.match('durum raporu ve günlük özet').map((skill) => skill.name), ['durum-raporu', 'gunluk-ozet']);
assert.deepEqual(registry.match('alakasız istek'), []);
assert.deepEqual(registry.match(''), []);
assert.deepEqual(registry.match(null), []);

// Daha az güvenilen kaynak, daha güvenilir aynı isimli kaydı gölgeleyemez.
for (const order of [
  [{ source: 'project', projectScope: 'a/b', manifest: manifest('ortak') }, { source: 'builtin', manifest: manifest('ortak') }],
  [{ source: 'builtin', manifest: manifest('ortak') }, { source: 'project', projectScope: 'a/b', manifest: manifest('ortak') }]
]) {
  const resolved = buildSkillRegistry(order, { agent, allowedProjectScopes: ['a/b'] });
  assert.equal(resolved.get('ortak').source, 'builtin');
  assert.deepEqual(resolved.shadowed, [{ name: 'ortak', source: 'project', shadowedBy: 'builtin' }]);
}

// Aynı güven düzeyindeki isim çakışması sessizce çözülmez.
assert.throws(() => buildSkillRegistry([{ source: 'user', manifest: manifest('ortak') }, { source: 'user', manifest: manifest('ortak') }], { agent }), /SKILL_NAME_CONFLICT/);

// Manifest sınırları registry üzerinden de zorunludur.
assert.throws(() => buildSkillRegistry([{ source: 'project', manifest: manifest('kapsamsiz') }], { agent }), /INVALID_SKILL_PROJECT_SCOPE/);
assert.throws(() => buildSkillRegistry([{ source: 'user', manifest: { ...manifest('yetki'), allowedTools: ['external.write'] } }], { agent }), /SKILL_TOOL_ESCALATION_FORBIDDEN/);
assert.throws(() => buildSkillRegistry([{ source: 'user', manifest: manifest('x'), trust: 9 }], { agent }), /INVALID_SKILL_REGISTRY_ENTRY_FIELD/);
for (const entries of [null, 'skills', Array.from({ length: 65 }, (_, i) => ({ source: 'user', manifest: manifest(`s-${i}`) }))]) {
  assert.throws(() => buildSkillRegistry(entries, { agent }), /INVALID_SKILL_REGISTRY/);
}
assert.throws(() => buildSkillRegistry([null], { agent }), /INVALID_SKILL_REGISTRY_ENTRY/);
assert.deepEqual(buildSkillRegistry([], { agent }).skills, []);

console.log('skills registry tests passed');
