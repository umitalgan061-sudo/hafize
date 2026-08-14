import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadAgentRegistry } from '../lib/agent-runtime.mjs';

const registry = await loadAgentRegistry();
const skills = JSON.parse(await readFile(new URL('../skills/registry.json', import.meta.url), 'utf8'));

const expected = new Map([
  ['minimal-engineer', 'selector'],
  ['agency-code-reviewer', 'specialist'],
  ['movie-coordinator', 'selector'],
  ['handyman-advisor', 'specialist']
]);

assert.equal(registry.agents.length, expected.size);
assert.equal(registry.defaultAgent, 'minimal-engineer');

const actual = new Map(registry.agents.map((agent) => [agent.id, agent.kind]));
assert.deepEqual(actual, expected);

const selectors = registry.agents.filter((agent) => agent.kind === 'selector');
const specialists = registry.agents.filter((agent) => agent.kind === 'specialist');
assert.deepEqual(selectors.map((agent) => agent.id), ['minimal-engineer', 'movie-coordinator']);
assert.deepEqual(specialists.map((agent) => agent.id), ['agency-code-reviewer', 'handyman-advisor']);

for (const selector of selectors) {
  assert.equal(selector.toolPolicy.default, 'deny');
  assert.equal(selector.toolPolicy.allow.includes('agent.delegate'), true);
}
for (const specialist of specialists) {
  assert.equal(specialist.toolPolicy.default, 'deny');
  assert.equal((specialist.toolPolicy.allow || []).includes('agent.delegate'), false);
}

const specialistIds = new Set(specialists.map((agent) => agent.id));
for (const skill of skills.skills) {
  if (skill.execution !== 'fork') continue;
  assert.equal(specialistIds.has(skill.forkAgentId), true, `${skill.id} must fork only to a registered specialist`);
}

const review = skills.skills.find((skill) => skill.id === 'review');
assert.equal(review.execution, 'fork');
assert.equal(review.forkAgentId, 'agency-code-reviewer');

for (const retiredId of ['hafize-general', 'agency-orchestrator', 'agency-minimal-engineer']) {
  assert.equal(actual.has(retiredId), false);
}

console.log('agent roster contract tests passed');
