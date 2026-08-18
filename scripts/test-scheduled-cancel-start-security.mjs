import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const executorSource = await readFile(new URL('../lib/scheduled-agent-executor.mjs', import.meta.url), 'utf8');
const completionSource = await readFile(new URL('../lib/scheduled-nvidia-completion.mjs', import.meta.url), 'utf8');
const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));

assert.match(executorSource, /if \(settled \|\| signal\.aborted\)/);
assert.match(executorSource, /approvalGranted/);
assert.match(completionSource, /const beforeStart = cancellationCode\(signal, runtime\)/);
assert.match(completionSource, /if \(beforeStart\) throw publicError\(beforeStart\)/);
assert.doesNotMatch(executorSource, /child_process|exec\(|spawn\(|shell\s*:\s*true/i);
assert.doesNotMatch(completionSource, /process\.env|Authorization|cookie|localStorage|sessionStorage|child_process/i);

assert.equal(registry.policy?.externalWritesRequireApproval, true);
assert.equal(registry.policy?.secretsNeverEnterAgentContext, true);
assert.equal(registry.policy?.sharedTraceIdRequired, true);
assert.equal(registry.agents?.length, 4);
assert.deepEqual(
  registry.agents.map((agent) => [agent.id, agent.kind]),
  [
    ['minimal-engineer', 'selector'],
    ['agency-code-reviewer', 'specialist'],
    ['movie-coordinator', 'selector'],
    ['handyman-advisor', 'specialist']
  ]
);
assert.ok(registry.agents.every((agent) => agent.toolPolicy?.default === 'deny'));

console.log('scheduled cancellation start-race security contract passed');
