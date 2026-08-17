import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));
const consent = await readFile(new URL('../public/hands-free-consent.js', import.meta.url), 'utf8');
const integration = await readFile(new URL('../docs/AGENCY_AGENTS_INTEGRATION.md', import.meta.url), 'utf8');

assert.equal(registry.agents.length, 4);
assert.deepEqual(registry.agents.map((agent) => agent.id), [
  'minimal-engineer',
  'agency-code-reviewer',
  'movie-coordinator',
  'handyman-advisor'
]);
assert.equal(registry.policy.externalWritesRequireApproval, true);
assert.equal(registry.policy.secretsNeverEnterAgentContext, true);
assert.equal(registry.policy.sharedTraceIdRequired, true);

for (const agent of registry.agents) {
  assert.equal(agent.toolPolicy.default, 'deny');
}
assert.ok(registry.agents.find((agent) => agent.id === 'minimal-engineer').toolPolicy.deny.includes('repo.merge'));
assert.ok(registry.agents.find((agent) => agent.id === 'agency-code-reviewer').toolPolicy.deny.includes('external.send'));

// Microphone consent is a renderer privacy boundary, never an agent/tool grant.
for (const token of ['agentId', 'toolPolicy', 'approvalGranted', 'repo.write_branch', 'repo.merge', 'external.send', 'external.write', 'secret.read']) {
  assert.equal(consent.includes(token), false, `consent must not contain ${token}`);
}
assert.match(integration, /Aktif runtime roster'ı tam olarak dört profildir/);
assert.match(integration, /Tool permission enforcement'i prompt seviyesinde değil backend kodunda uygula/);

console.log('hands-free consent registry boundary tests passed');
