import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/conversation-branch-lineage.js', import.meta.url), 'utf8');
const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));

assert.match(source, /const MAX_DEPTH = 12/);
assert.match(source, /wouldCreateInvalidAncestry/);
assert.match(source, /visited\.has\(cursor\)/);
assert.match(source, /depth > MAX_DEPTH/);
assert.match(source, /Kök sohbeti aç/);
assert.match(source, /ancestry\.depth > 1/);
assert.match(source, /openConversation\(context\.ancestry\.rootConversationId\)/);

for (const pattern of [
  /fetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /EventSource/,
  /sendBeacon/,
  /document\.cookie/,
  /Authorization/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /innerHTML\s*=/,
  /insertAdjacentHTML/,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/
]) assert.doesNotMatch(source, pattern);

assert.equal(registry.agents.length, 4);
assert.deepEqual(registry.agents.map((agent) => agent.id), [
  'minimal-engineer',
  'agency-code-reviewer',
  'movie-coordinator',
  'handyman-advisor'
]);
assert.equal(registry.policy.externalWritesRequireApproval, true);
assert.equal(registry.policy.secretsNeverEnterAgentContext, true);
for (const agent of registry.agents) assert.equal(agent.toolPolicy.default, 'deny');

console.log('conversation branch ancestry security tests passed');
