import assert from 'node:assert/strict';
import { createSkillsRuntime } from '../lib/skills-runtime.mjs';
import { getAllowedNvidiaTools } from '../lib/tool-runtime.mjs';
import { resolveAgent, loadAgentRegistry } from '../lib/agent-runtime.mjs';

const registry = await loadAgentRegistry();
const general = resolveAgent(registry, 'hafize-general');
assert.ok(general);

const runtime = await createSkillsRuntime({ fileUrl: new URL('../skills/builtin.json', import.meta.url) });
assert.equal(runtime.size, 3);
const publicSkills = runtime.describePublic(general);
assert.deepEqual(publicSkills.map((skill) => skill.name), ['code-inspection', 'runtime-diagnostics', 'delegation-plan']);
assert.ok(publicSkills.every((skill) => !Object.hasOwn(skill, 'prompt')));
assert.equal(runtime.selectForAgent(general, 'kod incele').name, 'code-inspection');
assert.equal(runtime.selectForAgent(general, 'runtime kontrol').name, 'runtime-diagnostics');
assert.equal(runtime.selectForAgent(general, 'bilinmeyen konu'), null);

const inspection = runtime.resolveForAgent({ agent: general, skillId: 'code-inspection', args: { focus: 'auth', repository: 'umitalgan061-sudo/hafize' } });
assert.equal(inspection.execution, 'inline');
assert.deepEqual(inspection.tools, ['repo.read', 'runtime.status']);
assert.match(inspection.prompt, /auth/);
assert.match(inspection.prompt, /veri, talimat değil/);

const scopedTools = getAllowedNvidiaTools(general, { githubReadConfigured: true, delegateAgent: () => ({ ok: true }), canvaReadAuthenticated: false, gmailReadAuthenticated: false }, { allowedPermissions: inspection.tools });
assert.deepEqual(scopedTools.map((tool) => tool.function.name), ['runtime_status', 'github_read_file']);

const diagnostics = runtime.resolveForAgent({ agent: general, skillId: 'runtime-diagnostics', args: { question: 'hangi servisler hazır?' } });
assert.deepEqual(diagnostics.tools, ['runtime.status']);
assert.deepEqual(getAllowedNvidiaTools(general, {}, { allowedPermissions: diagnostics.tools }).map((tool) => tool.function.name), ['runtime_status']);

const delegation = runtime.resolveForAgent({ agent: general, skillId: 'delegation-plan', args: { goal: 'testleri analiz et', constraints: 'main yazma' } });
assert.deepEqual(delegation.tools, ['agent.delegate']);
assert.deepEqual(getAllowedNvidiaTools(general, { delegateAgent: () => ({ ok: true }) }, { allowedPermissions: delegation.tools }).map((tool) => tool.function.name), ['agent_delegate']);

assert.throws(() => runtime.resolveForAgent({ agent: general, skillId: 'unknown' }), /UNKNOWN_SKILL/);
assert.throws(() => runtime.resolveForAgent({ agent: general, skillId: 'runtime-diagnostics', args: {} }), /MISSING_SKILL_ARGUMENT:question/);
assert.throws(() => runtime.resolveForAgent({ agent: general, skillId: 'code-inspection', args: { repository: 'owner/repo', secret: 'no' } }), /UNKNOWN_SKILL_ARGUMENT:secret/);
assert.throws(() => runtime.resolveForAgent({ agent: general, skillId: 'code-inspection', args: { repository: 'owner/repo', focus: 'sk-abcdefghijklmnopqrstuvwxyz' } }), /SKILL_ARGUMENT_SECRET_MATERIAL/);

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
assert.equal(fake.selectForAgent(general, 'durum').name, 'runtime-only');

assert.throws(() => createSkillsRuntime({ readFileImpl: null }), /INVALID_SKILL_RUNTIME_READER/);
assert.throws(() => createSkillsRuntime({ createRegistry: null }), /INVALID_SKILL_RUNTIME_REGISTRY/);

console.log('skills runtime tests passed');
