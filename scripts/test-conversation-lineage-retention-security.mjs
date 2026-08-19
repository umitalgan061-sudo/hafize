import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/conversation-branch-lineage.js', import.meta.url), 'utf8');
const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));

assert.match(source, /MAX_STORAGE_CHARS = 64 \* 1024/);
assert.match(source, /raw\.length > MAX_STORAGE_CHARS/);
assert.match(source, /function compactStoredEntries\(/);
assert.match(source, /storage\.setItem\(STORAGE_KEY, canonical\)/);
assert.match(source, /if \(raw === canonical\) return false/);
assert.match(source, /compactStoredEntries\(list\);/);
assert.match(source, /parseEntries\(raw, conversationIds\(list\)\)/);

assert.doesNotMatch(source, /\bfetch\s*\(/);
assert.doesNotMatch(source, /XMLHttpRequest/);
assert.doesNotMatch(source, /WebSocket/);
assert.doesNotMatch(source, /EventSource/);
assert.doesNotMatch(source, /sendBeacon/);
assert.doesNotMatch(source, /innerHTML\s*=/);
assert.doesNotMatch(source, /document\.cookie/);
assert.doesNotMatch(source, /Authorization/i);
assert.doesNotMatch(source, /access[_-]?token/i);
assert.doesNotMatch(source, /refresh[_-]?token/i);
assert.doesNotMatch(source, /ownerId/);
assert.doesNotMatch(source, /traceId/);
assert.doesNotMatch(source, /child_process/);
assert.doesNotMatch(source, /shell\s*:\s*true/);

assert.equal(registry.agents.length, 4);
assert.equal(registry.policy.externalWritesRequireApproval, true);
assert.equal(registry.policy.secretsNeverEnterAgentContext, true);
for (const agent of registry.agents) assert.equal(agent.toolPolicy.default, 'deny');

console.log('conversation lineage retention security tests passed');
