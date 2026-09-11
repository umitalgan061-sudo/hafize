// Guards the builtin skill catalog against the two failure modes that have
// already broken this repository:
//
// 1. A catalog entry that the manifest contract rejects. `lib/tool-runtime.mjs`
//    builds the builtin runtime at import time, so an invalid entry does not
//    degrade a feature — it stops the server from starting.
// 2. A catalog entry no agent policy can run. Such a skill is invisible in
//    every surface (list, select, rank) and silently dead configuration.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadAgentRegistry, resolveAgent } from '../lib/agent-runtime.mjs';
import { createBuiltinSkillsRuntimeSync } from '../lib/skills-runtime.mjs';
import { containsSecretMaterial, normalizeSkillManifest } from '../lib/skills-manifest.mjs';
import { listToolPermissions } from '../lib/tool-runtime.mjs';
import { CHECK_ROOT } from './check-support.mjs';

const registry = await loadAgentRegistry();
const agents = registry.agents.map((agent) => resolveAgent(registry, agent.id));
assert.ok(agents.length > 0, 'registry must expose at least one agent');

// Throws with the manifest error code if any entry is invalid.
const runtime = createBuiltinSkillsRuntimeSync();
assert.ok(runtime.size > 0, 'builtin catalog must not be empty');

const implementedPermissions = new Set(listToolPermissions().map(({ permission }) => permission));
const visibleNames = new Set();
const declaredTools = new Map();
const unusable = [];

for (const agent of agents) {
  for (const skill of runtime.describePublic(agent)) visibleNames.add(skill.name);
}

const catalog = JSON.parse(await readFile(`${CHECK_ROOT}/skills/builtin.json`, 'utf8'));
assert.equal(Array.isArray(catalog), true, 'builtin catalog must be an array');
assert.equal(catalog.length, runtime.size, 'every catalog entry must register exactly once');

for (const raw of catalog) {
  const manifest = normalizeSkillManifest(raw);
  const name = manifest.name;
  assert.equal(containsSecretMaterial(manifest.prompt), false, `skill prompt must not carry secret material: ${name}`);
  for (const tool of manifest.allowedTools) {
    assert.ok(
      implementedPermissions.has(tool),
      `skill ${name} declares ${tool}, which no runtime tool implements`
    );
  }
  declaredTools.set(name, [...manifest.allowedTools]);
  if (!visibleNames.has(name)) unusable.push({ name, tools: [...manifest.allowedTools] });
}

assert.deepEqual(
  unusable,
  [],
  `every builtin skill must be runnable by at least one agent policy; unusable: ${unusable.map((item) => `${item.name} (${item.tools.join(', ')})`).join('; ')}`
);

// Each visible skill resolves for the agent that sees it, with the granted
// tool set never exceeding what the skill declared.
for (const agent of agents) {
  for (const skill of runtime.describePublic(agent)) {
    if (skill.requiresApproval) continue;
    const args = {};
    for (const argument of skill.arguments) if (argument.required) args[argument.name] = 'doğrulama';
    const invocation = runtime.resolveForAgent({ agent, skillId: skill.name, args });
    assert.ok(invocation, `skill must resolve for ${agent.id}: ${skill.name}`);
    assert.ok(invocation.tools.length > 0, `resolved skill must grant at least one tool: ${skill.name}`);
    const declared = declaredTools.get(skill.name);
    for (const tool of invocation.tools) {
      assert.ok(declared.includes(tool), `resolved tool must be declared by the skill: ${skill.name}/${tool}`);
    }
  }
}

console.log(`Builtin skills OK: ${runtime.size} skills load, map to implemented tool permissions and are runnable by at least one agent`);
