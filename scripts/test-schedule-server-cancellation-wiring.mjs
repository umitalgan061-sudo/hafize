import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));

assert.match(server, /runWithScheduleCompletionSignal/);
assert.match(server, /async complete\(payload, signal\)/);
assert.match(server, /parentSignal:\s*signal/);
assert.match(server, /timeoutMs:\s*SCHEDULE_RUN_TIMEOUT_MS/);
assert.match(server, /nvidiaJsonCompletion\(payload, completionSignal\)/);
assert.doesNotMatch(
  server,
  /async complete\(payload\) \{\s*const controller = new AbortController\(\);\s*const timeout = setTimeout/,
  'scheduled provider callback must not ignore caller signal'
);

assert.match(server, /const scheduleWorkerController = new AbortController\(\)/);
assert.match(server, /SCHEDULE_WORKER\.runDue\(\{ signal: scheduleWorkerController\.signal \}\)/);
assert.match(server, /scheduleWorkerController\.abort\('server_shutdown'\)/);
assert.match(server, /!scheduleWorkerController\.signal\.aborted/);

const stopIndex = server.indexOf('stopScheduleWorkerLoop();');
const tickAwaitIndex = server.indexOf('if (scheduleTickPromise) await scheduleTickPromise;');
assert.ok(stopIndex > -1 && tickAwaitIndex > -1 && stopIndex < tickAwaitIndex,
  'shutdown must abort schedule worker before waiting for active tick');

assert.equal(registry.agents.length, 4);
assert.deepEqual(
  registry.agents.map((agent) => agent.id),
  ['minimal-engineer', 'agency-code-reviewer', 'movie-coordinator', 'handyman-advisor']
);
assert.equal(registry.policy.externalWritesRequireApproval, true);
assert.equal(registry.policy.secretsNeverEnterAgentContext, true);
for (const agent of registry.agents) assert.equal(agent.toolPolicy.default, 'deny');

for (const forbidden of ['shell=True', 'child_process.exec(', 'child_process.spawn(', 'process.env.NVIDIA_API_KEY =']) {
  assert.equal(server.includes(forbidden), false, `forbidden server pattern: ${forbidden}`);
}

console.log('schedule server cancellation wiring: ok');
