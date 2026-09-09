import assert from 'node:assert/strict';
import { createBuiltinSkillsRuntimeSync, createSkillsRuntime } from '../lib/skills-runtime.mjs';
import { loadAgentRegistry } from '../lib/agent-runtime.mjs';
import { listToolPermissions } from '../lib/tool-runtime.mjs';

// The builtin catalog is loaded at import time by the tool runtime, so a manifest
// the validator rejects takes the whole server down. Both loaders are exercised here.
const runtime = await createSkillsRuntime();
const syncRuntime = createBuiltinSkillsRuntimeSync();
assert.ok(runtime.size > 0);
assert.equal(syncRuntime.size, runtime.size);

const registry = await loadAgentRegistry();
const knownPermissions = new Set(listToolPermissions().map(({ permission }) => permission));

const names = new Set();
for (const agent of registry.agents) for (const skill of runtime.describePublic(agent)) names.add(skill.name);

for (const agent of registry.agents) {
  for (const skill of runtime.describePublic(agent)) {
    assert.equal(typeof skill.description, 'string');
    assert.equal(Object.hasOwn(skill, 'prompt'), false, `${skill.name} must not expose its prompt`);
    if (skill.requiresApproval) continue;
    const resolved = runtime.resolveForAgent({
      agent,
      skillId: skill.name,
      args: Object.fromEntries(skill.arguments.filter((item) => item.required).map((item) => [item.name, 'test']))
    });
    assert.ok(resolved.tools.length > 0, `${skill.name} resolves to no tool for ${agent.id}`);
    for (const tool of resolved.tools) {
      assert.ok(knownPermissions.has(tool), `${skill.name} declares unknown permission ${tool}`);
    }
  }
}

// A skill no agent can see is dead weight: catch it here instead of in production.
assert.equal(names.size, runtime.size, `unreachable builtin skills: ${runtime.size - names.size}`);

console.log('builtin skill reachability tests passed');
