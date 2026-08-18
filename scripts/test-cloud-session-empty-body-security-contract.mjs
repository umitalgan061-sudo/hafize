import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const policy = await readFile(new URL('../lib/cloud-session-empty-body-policy.mjs', import.meta.url), 'utf8');
const api = await readFile(new URL('../lib/cloud-session-http-api.mjs', import.meta.url), 'utf8');
const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));

assert.match(api, /requireEmptyCloudSessionBody\(headers\);[\s\S]*auth\.authenticate/, 'status must gate framing before authenticate');
assert.match(api, /requireSameOrigin\(headers\);[\s\S]*requireEmptyCloudSessionBody\(headers\);[\s\S]*auth\.revoke/, 'logout must gate origin then framing before revoke');
assert.match(api, /CLOUD_SESSION_BODY_NOT_ALLOWED/);
assert.match(api, /connection: 'close'/);

for (const forbidden of [
  'child_process',
  'exec(',
  'spawn(',
  'shell: true',
  'shell=True',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'document.cookie',
  'process.env',
  'Authorization',
  'GITHUB_TOKEN',
  'NVIDIA_API_KEY'
]) {
  assert.equal(policy.includes(forbidden), false, `policy must not introduce ${forbidden}`);
}

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
for (const agent of registry.agents) assert.equal(agent.toolPolicy.default, 'deny');

console.log('cloud session empty-body security contract: ok');
