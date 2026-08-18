import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workerSource = await readFile(new URL('../lib/schedule-worker.mjs', import.meta.url), 'utf8');
const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));
assert.equal(registry.agents.length, 4);
assert.equal(registry.policy.externalWritesRequireApproval, true);
assert.equal(registry.policy.secretsNeverEnterAgentContext, true);
assert.equal(registry.policy.sharedTraceIdRequired, true);
assert.match(workerSource, /DEFAULT_MAX_BATCH = 8/);
assert.match(workerSource, /DEFAULT_MAX_CONCURRENCY = 2/);
assert.match(workerSource, /MAX_BATCH_LIMIT = 64/);
assert.match(workerSource, /MAX_CONCURRENCY_LIMIT = 8/);
assert.match(workerSource, /store\.claimDue\(\{ limit: claimLimit \}\)/);
assert.match(workerSource, /mapWithConcurrency\(claimed, configuredConcurrency, executeClaimed\)/);
for (const forbidden of ['child_process', 'shell: true', 'shell=True', 'process.env.NVIDIA_API_KEY', 'Authorization:', 'GITHUB_TOKEN']) {
  assert.equal(workerSource.includes(forbidden), false, `forbidden worker surface: ${forbidden}`);
}
for (const agent of registry.agents) assert.equal(agent.toolPolicy.default, 'deny');
console.log('schedule worker security contract ok');
