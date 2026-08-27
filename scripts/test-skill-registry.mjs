import assert from 'node:assert/strict';
import { createSkillRegistry } from '../lib/skill-registry.mjs';

const agent = {
  id: 'hafize-general',
  name: 'Hafize',
  toolPolicy: {
    default: 'deny',
    allow: ['agent.delegate', 'task.read', 'connector.gmail.read'],
    approvalRequired: ['external.send']
  }
};
const readOnlyAgent = {
  id: 'agency-reviewer',
  name: 'Reviewer',
  toolPolicy: { default: 'deny', allow: ['task.read'] }
};

function manifest(overrides = {}) {
  return {
    id: 'gmail-triage',
    name: 'Gmail Triyaj',
    description: 'Gelen kutusunu öncelik sırasına göre özetler.',
    triggers: ['gelen kutusu', 'mail özeti'],
    allowedTools: ['connector.gmail.read'],
    arguments: [{ name: 'query', required: true }, { name: 'limit', type: 'number' }],
    prompt: 'Gelen kutusunu özetle.',
    ...overrides
  };
}

const registry = createSkillRegistry({
  projectScopeAllowed: true,
  entries: [
    { source: 'user', manifest: manifest() },
    { source: 'builtin', manifest: manifest({ name: 'Gmail Triyaj (builtin)' }) },
    { source: 'project', manifest: manifest({ id: 'repo-review', name: 'Repo İnceleme', triggers: ['repo incele'], allowedTools: ['task.read'], arguments: [], execution: 'fork' }) },
    { source: 'user', manifest: manifest({ id: 'broken', prompt: '' }) },
    { source: 'plugin', manifest: manifest({ id: 'unknown-source' }) }
  ]
});

// Builtin öncelik sırasında en yüksektir; user/project bir builtin skill'i gölgeleyemez.
assert.equal(registry.get('gmail-triage').source, 'builtin');
assert.equal(registry.get('gmail-triage').name, 'Gmail Triyaj (builtin)');
assert.deepEqual(registry.list().map((skill) => skill.id), ['gmail-triage', 'repo-review']);
assert.equal(registry.get('missing'), null);

const skipped = registry.skipped();
assert.equal(skipped.some((item) => item.id === 'gmail-triage' && item.source === 'user' && item.reason === 'shadowed_by_higher_precedence'), true);
assert.equal(skipped.some((item) => item.id === 'broken' && item.reason === 'INVALID_SKILL_MANIFEST:prompt'), true);
assert.equal(skipped.some((item) => item.reason === 'unknown_source'), true);

// Project skill yalnız açıkça izin verilen proje kapsamıyla yüklenir.
const closed = createSkillRegistry({ entries: [{ source: 'project', manifest: manifest({ id: 'repo-review', triggers: ['repo incele'] }) }] });
assert.deepEqual(closed.list().map((skill) => skill.id), []);
assert.equal(closed.skipped()[0].reason, 'project_scope_not_allowed');

// Tetikleyici eşleşmesi salt-okunur ve sınırlıdır.
assert.deepEqual(registry.match('Bugünkü GELEN KUTUSU durumunu göster').map((skill) => skill.id), ['gmail-triage']);
assert.deepEqual(registry.match('alakasız istek').map((skill) => skill.id), []);
assert.deepEqual(registry.match('   ').map((skill) => skill.id), []);
assert.deepEqual(registry.match(null).map((skill) => skill.id), []);

const resolved = registry.resolve('gmail-triage', { agent, args: { query: '  fatura  ', limit: 5 } });
assert.equal(resolved.ok, true);
assert.equal(resolved.execution.mode, 'inline');
assert.equal(resolved.execution.agentId, 'hafize-general');
assert.deepEqual([...resolved.execution.tools], ['connector.gmail.read']);
assert.deepEqual({ ...resolved.execution.arguments }, { query: 'fatura', limit: 5 });
assert.equal(Object.isFrozen(resolved.execution), true);

assert.equal(registry.resolve('missing', { agent }).error, 'SKILL_NOT_FOUND');
assert.equal(registry.resolve('gmail-triage', {}).error, 'SKILL_AGENT_REQUIRED');

// Skill, ajan policy'sinin ötesinde araç kullanamaz.
assert.equal(registry.resolve('gmail-triage', { agent: readOnlyAgent }).error, 'SKILL_TOOL_NOT_AUTHORIZED');
// Fork execution delegasyon yetkisi ister.
assert.equal(registry.resolve('repo-review', { agent: readOnlyAgent }).error, 'SKILL_FORK_NOT_AUTHORIZED');
assert.equal(registry.resolve('repo-review', { agent }).execution.mode, 'fork');

assert.equal(registry.resolve('gmail-triage', { agent, args: { limit: 1 } }).error, 'SKILL_ARGUMENT_MISSING');
assert.equal(registry.resolve('gmail-triage', { agent, args: { query: 'x', extra: 1 } }).error, 'SKILL_ARGUMENT_UNKNOWN');
assert.equal(registry.resolve('gmail-triage', { agent, args: { query: 42 } }).error, 'SKILL_ARGUMENT_INVALID');
assert.equal(registry.resolve('gmail-triage', { agent, args: { query: 'x'.repeat(2001) } }).error, 'SKILL_ARGUMENT_INVALID');
assert.equal(registry.resolve('gmail-triage', { agent, args: { query: 'x', limit: Number.NaN } }).error, 'SKILL_ARGUMENT_INVALID');
assert.equal(registry.resolve('gmail-triage', { agent, args: [] }).error, 'SKILL_ARGUMENTS_INVALID');

assert.throws(() => createSkillRegistry({ entries: null }), /INVALID_SKILL_REGISTRY:entries/);
assert.throws(
  () => createSkillRegistry({ entries: Array.from({ length: 65 }, (_, index) => ({ source: 'builtin', manifest: manifest({ id: `skill-${index}` }) })) }),
  /INVALID_SKILL_REGISTRY:tooManySkills/
);

console.log('skill registry tests passed');
