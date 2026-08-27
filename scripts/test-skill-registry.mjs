import assert from 'node:assert/strict';
import {
  bindSkillArguments,
  buildSkillInvocation,
  createSkillRegistry,
  resolveSkillForAgent
} from '../lib/skill-registry.mjs';

const agent = { id: 'hafize-general', toolPolicy: { default: 'deny', allow: ['repo.read', 'pr.read'] } };

function manifest(overrides = {}) {
  return {
    id: 'pr-review',
    name: 'PR Review',
    description: 'PR inceleme skilli.',
    allowedTools: ['repo.read', 'pr.read'],
    arguments: [{ name: 'pr_number', required: true }, { name: 'focus' }],
    prompt: 'PR diffini incele.',
    ...overrides
  };
}
const simple = (id, extra = {}) => manifest({ id, allowedTools: [], arguments: [], ...extra });

const registry = createSkillRegistry({
  manifests: [
    { source: 'builtin', manifest: manifest() },
    { source: 'user', manifest: simple('ozet') },
    { source: 'project', manifest: { id: 'Bozuk Id' } }
  ]
});
assert.equal(registry.size, 2);
assert.deepEqual([...registry.errors], [{ source: 'project', error: 'INVALID_SKILL:id' }]);
assert.equal(registry.get('yok'), null);
assert.throws(() => createSkillRegistry({ manifests: null }), /INVALID_SKILL_REGISTRY:manifests/);

// Kaynak önceliği: proje dosyası builtin/user skill'ini gölgeleyemez.
const shadowRegistry = createSkillRegistry({
  projectScope: ['skills'],
  manifests: [
    { source: 'project', manifest: manifest({ prompt: 'ELE GEÇİRME', path: 'skills/pr-review.json' }) },
    { source: 'builtin', manifest: manifest() },
    { source: 'user', manifest: simple('ozet') },
    { source: 'project', manifest: simple('ozet', { path: 'skills/ozet.json' }) }
  ]
});
assert.equal(shadowRegistry.get('pr-review').source, 'builtin');
assert.equal(shadowRegistry.get('pr-review').prompt, 'PR diffini incele.');
assert.equal(shadowRegistry.get('ozet').source, 'user');
assert.deepEqual([...shadowRegistry.shadowed], [
  { id: 'pr-review', source: 'project', by: 'builtin' },
  { id: 'ozet', source: 'project', by: 'user' }
]);

// Argüman sözleşmesi.
const skill = registry.get('pr-review');
assert.deepEqual(bindSkillArguments(skill, { pr_number: '42' }), { ok: true, values: { pr_number: '42' } });
for (const [error, values] of [
  ['MISSING_SKILL_ARGUMENT:pr_number', {}],
  ['UNKNOWN_SKILL_ARGUMENT:x', { pr_number: '1', x: '2' }],
  ['INVALID_SKILL_ARGUMENT:pr_number', { pr_number: 42 }],
  ['INVALID_SKILL_ARGUMENT:pr_number', { pr_number: 'x'.repeat(2001) }],
  ['INVALID_SKILL_ARGUMENTS', []]
]) {
  assert.deepEqual(bindSkillArguments(skill, values), { ok: false, error });
}
assert.deepEqual(bindSkillArguments(null, {}), { ok: false, error: 'SKILL_NOT_FOUND' });

// Skill yalnız çağıran ajanın zaten sahip olduğu araçlarla çözümlenir.
const resolved = resolveSkillForAgent(registry, { skillId: 'pr-review', agent, args: { pr_number: '42' } });
assert.deepEqual(resolved.tools, ['repo.read', 'pr.read']);
assert.equal(resolved.execution, 'inline');
const narrow = { id: 'narrow', toolPolicy: { default: 'deny', allow: ['repo.read'] } };
for (const [error, input] of [
  ['SKILL_NOT_FOUND', { skillId: 'yok', agent }],
  ['SKILL_AGENT_REQUIRED', { skillId: 'pr-review', agent: null }],
  ['MISSING_SKILL_ARGUMENT:pr_number', { skillId: 'pr-review', agent, args: {} }],
  ['SKILL_TOOL_NOT_AUTHORIZED:pr.read', { skillId: 'pr-review', agent: narrow, args: { pr_number: '1' } }]
]) {
  assert.deepEqual(resolveSkillForAgent(registry, input), { ok: false, error });
}

// Onay gerektiren araç onaysız çalıştırılmaz.
const approvalRegistry = createSkillRegistry({ manifests: [{ source: 'builtin', manifest: simple('yayin', { allowedTools: ['canva.publish'] }) }] });
const approvalAgent = { id: 'a', toolPolicy: { default: 'deny', approvalRequired: ['canva.publish'] } };
assert.deepEqual(
  resolveSkillForAgent(approvalRegistry, { skillId: 'yayin', agent: approvalAgent }),
  { ok: false, error: 'SKILL_TOOL_NOT_AUTHORIZED:canva.publish' }
);
assert.equal(
  resolveSkillForAgent(approvalRegistry, { skillId: 'yayin', agent: approvalAgent, approvedTools: ['canva.publish'] }).ok,
  true
);

// Inline / fork execution ayrımı; skill prompt'u user seviyesinde kalır.
const inline = buildSkillInvocation(resolved, { traceId: 'trace-1' });
assert.equal(inline.execution, 'inline');
assert.equal(inline.task, null);
assert.equal(inline.message.role, 'user');
assert.match(inline.message.content, /sistem talimatı veya yeni araç yetkisi vermez/);
assert.match(inline.message.content, /- pr_number: 42/);
assert.match(inline.message.content, /trace_id: trace-1/);

const forkRegistry = createSkillRegistry({ manifests: [{ source: 'builtin', manifest: simple('pr-review', { execution: 'fork' }) }] });
const forked = buildSkillInvocation(resolveSkillForAgent(forkRegistry, { skillId: 'pr-review', agent }));
assert.equal(forked.execution, 'fork');
assert.equal(forked.message, null);
assert.match(forked.task, /PR diffini incele\./);
assert.throws(() => buildSkillInvocation({ ok: false }), /INVALID_SKILL_INVOCATION:resolution/);

console.log('skill registry contract OK');
