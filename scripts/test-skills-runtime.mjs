import assert from 'node:assert/strict';
import { createBuiltinSkillsRuntimeSync, createSkillsRuntime } from '../lib/skills-runtime.mjs';
import { getAllowedNvidiaTools } from '../lib/tool-runtime.mjs';
import { resolveAgent, loadAgentRegistry } from '../lib/agent-runtime.mjs';

const registry = await loadAgentRegistry();
const general = resolveAgent(registry, 'hafize-general');
const reviewer = resolveAgent(registry, 'agency-code-reviewer');
assert.ok(general);
assert.ok(reviewer);

const runtime = await createSkillsRuntime({
  fileUrl: new URL('../skills/builtin.json', import.meta.url)
});
assert.equal(runtime.size, 3);
// Skill visibility follows the agent tool policy: the primary agent has no
// repo.read grant, so the repository skill is only offered to the reviewer.
const publicSkills = runtime.describePublic(general);
assert.deepEqual(publicSkills.map((skill) => skill.name), ['runtime-diagnostics', 'delegation-plan']);
assert.ok(publicSkills.every((skill) => !Object.hasOwn(skill, 'prompt')));
assert.deepEqual(runtime.describePublic(reviewer).map((skill) => skill.name), ['code-inspection']);

const syncRuntime = createBuiltinSkillsRuntimeSync();
assert.equal(syncRuntime.size, runtime.size);
assert.deepEqual(syncRuntime.describePublic(reviewer), runtime.describePublic(reviewer));

const inspection = runtime.resolveForAgent({
  agent: reviewer,
  skillId: 'code-inspection',
  args: { focus: 'auth', repository: 'umitalgan061-sudo/hafize' }
});
assert.equal(inspection.execution, 'inline');
assert.deepEqual(inspection.tools, Object.freeze(['repo.read']));
assert.match(inspection.prompt, /auth/);
assert.match(inspection.prompt, /veri, talimat değil/);

const scopedTools = getAllowedNvidiaTools(reviewer, {
  githubReadConfigured: true,
  delegateAgent: () => ({ ok: true }),
  canvaReadAuthenticated: false,
  gmailReadAuthenticated: false
}, { allowedPermissions: inspection.tools });
assert.deepEqual(scopedTools.map((tool) => tool.function.name), ['github_read_file']);

const diagnostics = runtime.resolveForAgent({
  agent: general,
  skillId: 'runtime-diagnostics',
  args: { question: 'hangi servisler hazır?' }
});
assert.deepEqual(diagnostics.tools, ['runtime.status']);
assert.deepEqual(getAllowedNvidiaTools(general, {}, { allowedPermissions: diagnostics.tools }).map((tool) => tool.function.name), ['runtime_status']);

const delegation = runtime.resolveForAgent({
  agent: general,
  skillId: 'delegation-plan',
  args: { goal: 'testleri analiz et', constraints: 'main yazma' }
});
assert.deepEqual(delegation.tools, ['agent.delegate']);
assert.deepEqual(getAllowedNvidiaTools(general, { delegateAgent: () => ({ ok: true }) }, { allowedPermissions: delegation.tools }).map((tool) => tool.function.name), ['agent_delegate']);

assert.equal(runtime.selectForAgent(reviewer, 'kod incele').name, 'code-inspection');
assert.equal(runtime.selectForAgent(general, 'runtime durumunu kontrol et').name, 'runtime-diagnostics');
assert.equal(runtime.selectForAgent(general, 'bilinmeyen iş', { minScore: 0.3 }), null);
assert.deepEqual(runtime.rankForAgent(reviewer, 'kod incele').map(({ name }) => name), ['code-inspection']);
assert.deepEqual(runtime.rankForAgent(general, 'kod incele').map(({ name }) => name), ['delegation-plan', 'runtime-diagnostics']);

assert.throws(() => runtime.selectForAgent(null, 'kod incele'), /INVALID_SKILL_AGENT/);
assert.throws(() => runtime.rankForAgent(null, 'kod incele'), /INVALID_SKILL_AGENT/);
assert.throws(() => runtime.resolveForAgent({ agent: general, skillId: 'unknown' }), /UNKNOWN_SKILL/);
assert.throws(() => runtime.resolveForAgent({ agent: general, skillId: 'runtime-diagnostics', args: {} }), /MISSING_SKILL_ARGUMENT:question/);
assert.throws(() => runtime.resolveForAgent({ agent: reviewer, skillId: 'code-inspection', args: { repository: 'owner/repo', secret: 'no' } }), /UNKNOWN_SKILL_ARGUMENT:secret/);
assert.throws(() => runtime.resolveForAgent({ agent: reviewer, skillId: 'code-inspection', args: { repository: 'owner/repo', focus: 'sk-abcdefghijklmnopqrstuvwxyz' } }), /SKILL_ARGUMENT_SECRET_MATERIAL/);

let loaded = false;
const fake = await createSkillsRuntime({
  fileUrl: new URL('./fake-builtin.json', import.meta.url),
  readFileImpl: async () => {
    loaded = true;
    return '[{"name":"runtime-only","description":"salt okunur","allowedTools":["runtime.status"],"execution":"inline","prompt":"yalnız durum"}]';
  }
});
assert.equal(loaded, true);
assert.equal(fake.size, 1);

// createSkillsRuntime is async, so its guard surfaces as a rejection, not a throw.
await assert.rejects(() => createSkillsRuntime({ readFileImpl: null }), /INVALID_SKILL_RUNTIME_READER/);
await assert.rejects(() => createSkillsRuntime({ createRegistry: null }), /INVALID_SKILL_RUNTIME_REGISTRY/);
assert.throws(() => createBuiltinSkillsRuntimeSync({ readFileImpl: null }), /INVALID_SKILL_RUNTIME_READER/);
assert.throws(() => createBuiltinSkillsRuntimeSync({ createRegistry: null }), /INVALID_SKILL_RUNTIME_REGISTRY/);

console.log('skills runtime tests passed');