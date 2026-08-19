import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/keyboard-shortcuts.js', import.meta.url), 'utf8');
const searchSource = await readFile(new URL('../public/conversation-search.js', import.meta.url), 'utf8');
const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));

assert.match(source, /focusConversationSearch:\s*'mod\+shift\+f'/);
assert.match(source, /querySelector\('#conversationSearchInput'\)/);
assert.match(source, /searchInput\.focus\(\)/);
assert.match(source, /isConversationSearchShortcut\(event\)/);

for (const forbidden of [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /EventSource/,
  /sendBeacon/,
  /localStorage/,
  /sessionStorage/,
  /indexedDB/i,
  /document\.cookie/,
  /navigator\.clipboard/,
  /Authorization/i,
  /Bearer\s+/i,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/
]) {
  assert.equal(forbidden.test(source), false, `keyboard shortcut source opened forbidden surface: ${forbidden}`);
}

assert.match(searchSource, /HafizeConversationStorageGuard/);
assert.doesNotMatch(searchSource, /\bfetch\s*\(/);
assert.doesNotMatch(searchSource, /localStorage\.setItem/);

assert.equal(registry.agents.length, 4);
assert.equal(registry.policy.externalWritesRequireApproval, true);
assert.equal(registry.policy.secretsNeverEnterAgentContext, true);
for (const agent of registry.agents) {
  assert.equal(agent.toolPolicy.default, 'deny');
}

console.log('conversation search shortcut security contract tests passed');
