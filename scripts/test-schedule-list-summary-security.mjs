import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [summarySource, httpSource, uiSource, registryText] = await Promise.all([
  readFile(new URL('../lib/schedule-list-summary.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/schedule-http-api.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../public/schedule-list.js', import.meta.url), 'utf8'),
  readFile(new URL('../agents/registry.json', import.meta.url), 'utf8')
]);
const registry = JSON.parse(registryText);

assert.equal(registry.agents.length, 4);
assert.equal(registry.defaultAgent, 'minimal-engineer');
assert.deepEqual(registry.agents.map((agent) => agent.id).sort(), [
  'agency-code-reviewer',
  'handyman-advisor',
  'minimal-engineer',
  'movie-coordinator'
]);
assert.equal(registry.delegationPolicy.externalWritesRequireApproval, true);
assert.equal(registry.delegationPolicy.secretsNeverEnterAgentContext, true);
assert.equal(registry.delegationPolicy.sharedTraceIdRequired, true);
for (const agent of registry.agents) assert.equal(agent.toolPolicy.default, 'deny');

assert.match(httpSource, /LIST_QUERY_FIELDS = new Set\(\['limit', 'offset', 'snapshot', 'view'\]\)/);
assert.match(httpSource, /pagination\.view === 'summary' \? summarizeScheduleListOutput\(bounded\) : bounded/);
assert.match(uiSource, /view: 'summary'/);
assert.match(uiSource, /credentials: 'same-origin'/);
assert.match(uiSource, /cache: 'no-store'/);
assert.match(summarySource, /MAX_SUMMARY_TASK_CHARS = 180/);
assert.match(summarySource, /MAX_SUMMARY_TASK_BYTES = 720/);

for (const source of [summarySource, httpSource]) {
  for (const forbidden of [
    'child_process',
    'execSync',
    'spawnSync',
    'shell: true',
    'shell=True',
    'process.env.GITHUB_TOKEN',
    'process.env.NVIDIA_API_KEY',
    'process.env.GOOGLE',
    'process.env.CANVA',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'document.cookie',
    'Authorization: `Bearer',
    'http://integrate.api.nvidia.com',
    'https://integrate.api.nvidia.com'
  ]) assert.equal(source.includes(forbidden), false, `summary boundary contains forbidden surface: ${forbidden}`);
}

for (const forbidden of [
  'ownerId:',
  'traceId:',
  'lastError:',
  'result:',
  'approvalToken',
  'accessToken',
  'refreshToken',
  'clientSecret',
  'signingKey'
]) assert.equal(summarySource.includes(forbidden), false, `summary projection explicitly emits forbidden field: ${forbidden}`);

assert.equal(httpSource.includes("method: 'POST'"), false, 'summary list work must not add a new POST client');
assert.equal(httpSource.includes('fetch('), false, 'schedule HTTP boundary must not create provider/network calls');
assert.equal(uiSource.includes('requestSubmit('), false);
assert.equal(uiSource.includes('.submit('), false);
assert.equal(uiSource.includes("method: 'DELETE'"), false);
assert.equal(uiSource.includes("method: 'PATCH'"), false);
assert.equal(uiSource.includes("method: 'POST'"), false);

const summaryFieldsMatch = summarySource.match(/return Object\.freeze\(\{\n\s*scheduleId,[\s\S]*?maxAttempts\n\s*\}\);/);
assert.ok(summaryFieldsMatch, 'summary output field object must remain explicit');
for (const required of ['scheduleId', 'agentId', 'task:', 'taskTruncated', 'runAt', 'status', 'attempts', 'maxAttempts']) {
  assert.equal(summaryFieldsMatch[0].includes(required), true, `summary missing required field ${required}`);
}
for (const forbidden of ['ownerId', 'traceId', 'lastError', 'result', 'retryDelayMs', 'createdAt', 'updatedAt']) {
  assert.equal(summaryFieldsMatch[0].includes(forbidden), false, `summary object contains forbidden field ${forbidden}`);
}

console.log('schedule list summary security contract tests passed');
