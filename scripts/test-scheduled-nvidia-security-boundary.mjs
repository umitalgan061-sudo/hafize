import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const helper = await readFile(new URL('../lib/scheduled-nvidia-completion.mjs', import.meta.url), 'utf8');
const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));

assert.equal(registry.policy.externalWritesRequireApproval, true);
assert.equal(registry.policy.secretsNeverEnterAgentContext, true);
assert.equal(registry.policy.sharedTraceIdRequired, true);
assert.equal(registry.agents.length, 4);
assert.deepEqual(
  registry.agents.map((agent) => agent.id).sort(),
  ['agency-code-reviewer', 'handyman-advisor', 'minimal-engineer', 'movie-coordinator'].sort()
);
for (const agent of registry.agents) {
  assert.equal(agent.toolPolicy?.default, 'deny', `${agent.id} must remain default-deny`);
}
const minimal = registry.agents.find((agent) => agent.id === 'minimal-engineer');
assert.ok(minimal);
assert.equal(minimal.toolPolicy.approvalRequired.includes('repo.write_branch'), true);
assert.equal(minimal.toolPolicy.deny.includes('repo.merge'), true);
assert.equal(minimal.toolPolicy.deny.includes('external.send'), true);
assert.equal(minimal.toolPolicy.deny.includes('external.write'), true);

for (const forbidden of [
  'process.env',
  'NVIDIA_API_KEY',
  'GITHUB_TOKEN',
  'Authorization',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'document.cookie',
  'child_process',
  'exec(',
  'spawn(',
  'shell: true',
  'fetch('
]) {
  assert.equal(helper.includes(forbidden), false, `helper must not contain ${forbidden}`);
}
assert.match(helper, /createBoundedAbortRuntime/);
assert.match(helper, /SCHEDULE_AGENT_RUN_CANCELLED/);
assert.match(helper, /SCHEDULE_AGENT_RUN_TIMEOUT/);
assert.doesNotMatch(helper, /external\.(send|write)/);
assert.doesNotMatch(helper, /repo\.(merge|write_branch)/);

assert.match(server, /Authorization: `Bearer \$\{NVIDIA_API_KEY\}`/);
assert.match(server, /approvalGranted: false/);
assert.doesNotMatch(server, /approvalGranted:\s*true/);
assert.doesNotMatch(server, /shell\s*:\s*true/);
assert.doesNotMatch(server, /from ['"]node:child_process['"]/);
assert.match(server, /createScheduledNvidiaCompletion\(\{/);
assert.match(server, /complete: nvidiaJsonCompletion/);
assert.match(server, /timeoutMs: SCHEDULE_RUN_TIMEOUT_MS/);

process.stdout.write('scheduled NVIDIA security boundary passed\n');
