import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBuiltinSkillsRuntimeSync } from '../lib/skills-runtime.mjs';
import { loadAgentRegistry, resolveAgent } from '../lib/agent-runtime.mjs';
import { executeNvidiaToolCall, getAllowedNvidiaTools } from '../lib/tool-runtime.mjs';

const registry = await loadAgentRegistry();
const agent = resolveAgent(registry, 'hafize-general');
assert.ok(agent, 'the configured primary agent must exist');

const withoutRuntime = getAllowedNvidiaTools(agent, { traceId: 'test', agent });
assert.equal(
  withoutRuntime.some((tool) => tool.function.name === 'skill_invoke'),
  false,
  'skill_invoke must stay unavailable when no runtime is provided'
);

const skillsRuntime = createBuiltinSkillsRuntimeSync();
assert.ok(skillsRuntime.size > 0, 'the built-in catalog must load');
const context = { traceId: 'skills-runtime-test', agent, skillsRuntime };
const withRuntime = getAllowedNvidiaTools(agent, context);
assert.equal(
  withRuntime.some((tool) => tool.function.name === 'skill_invoke'),
  true,
  'the authorized primary agent must be offered skill_invoke when wired'
);

const result = await executeNvidiaToolCall(agent, {
  id: 'call-skill-runtime',
  type: 'function',
  function: {
    name: 'skill_invoke',
    arguments: JSON.stringify({
      skillId: 'runtime-diagnostics',
      args: { question: 'hangi servisler hazır?' }
    })
  }
}, context);
assert.equal(result.ok, true, 'skill invocation must be resolved by the actual tool runtime');
assert.equal(result.tool, 'skill_invoke');
assert.equal(result.value?.skill, 'runtime-diagnostics');
assert.match(result.value?.prompt || '', /hangi servisler hazır/);

const serverSource = await readFile(new URL('../server.ts', import.meta.url), 'utf8');
assert.match(serverSource, /createBuiltinSkillsRuntimeSync/);
assert.match(serverSource, /const SKILLS_RUNTIME = createBuiltinSkillsRuntimeSync\(\)/);
assert.ok((serverSource.match(/skillsRuntime: SKILLS_RUNTIME/g) || []).length >= 4,
  'HTTP chat, tool execution, delegation and scheduled execution must share the runtime');
assert.match(serverSource, /skills: \{ status: SKILLS_RUNTIME\.size > 0 \? 'ready' : 'blocked' \}/);
assert.match(serverSource, /complete: \(payload, delegatedSignal\) => nvidiaJsonCompletion\(payload, delegatedSignal \?\? signal \?\? requestAbort\.signal\)/);

console.log('skills runtime production wiring: OK');
