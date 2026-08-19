import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/conversation-branch-lineage.js', import.meta.url), 'utf8');
const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));

assert.match(source, /function resolveSiblings\(/);
assert.match(source, /parentConversationId === current\.parentConversationId/);
assert.match(source, /sourceMessageId === current\.sourceMessageId/);
assert.match(source, /compareSiblingEntries/);
assert.match(source, /previousConversationId/);
assert.match(source, /nextConversationId/);
assert.match(source, /alternatif \$\{context\.siblings\.index \+ 1\}\/\$\{context\.siblings\.entries\.length\}/);
assert.match(source, /← Önceki alternatif/);
assert.match(source, /Sonraki alternatif →/);
assert.match(source, /openPreviousSibling/);
assert.match(source, /openNextSibling/);

assert.doesNotMatch(source, /\bfetch\s*\(/);
assert.doesNotMatch(source, /XMLHttpRequest/);
assert.doesNotMatch(source, /WebSocket/);
assert.doesNotMatch(source, /EventSource/);
assert.doesNotMatch(source, /sendBeacon/);
assert.doesNotMatch(source, /innerHTML\s*=/);
assert.doesNotMatch(source, /insertAdjacentHTML/);
assert.doesNotMatch(source, /document\.cookie/);
assert.doesNotMatch(source, /Authorization/i);
assert.doesNotMatch(source, /access[_-]?token/i);
assert.doesNotMatch(source, /refresh[_-]?token/i);
assert.doesNotMatch(source, /ownerId/);
assert.doesNotMatch(source, /traceId/);
assert.doesNotMatch(source, /child_process/);
assert.doesNotMatch(source, /\bexec\s*\(/);
assert.doesNotMatch(source, /\bspawn\s*\(/);
assert.doesNotMatch(source, /shell\s*:\s*true/);

assert.match(source, /MAX_ENTRIES = 60/);
assert.match(source, /MAX_DEPTH = 12/);
assert.match(source, /MAX_ID_CHARS = 120/);
assert.match(source, /textContent =/);
assert.match(source, /min-height:44px/);
assert.match(source, /focus-visible/);
assert.match(source, /forced-colors:active/);

assert.equal(registry.agents.length, 4);
assert.deepEqual(
  registry.agents.map((agent) => agent.id).sort(),
  ['agency-code-reviewer', 'handyman-advisor', 'minimal-engineer', 'movie-coordinator'].sort()
);
for (const agent of registry.agents) {
  assert.equal(agent.toolPolicy.default, 'deny');
}
assert.equal(registry.policy.externalWritesRequireApproval, true);
assert.equal(registry.policy.secretsNeverEnterAgentContext, true);
assert.equal(registry.policy.sharedTraceIdRequired, true);

console.log('conversation branch alternative security tests passed');
