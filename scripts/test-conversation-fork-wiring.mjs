import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const insights = require('../public/conversation-insights.js');
const swPolicy = require('../public/sw-policy.js');

assert.equal(insights.FORK_SCRIPT_ID, 'hafizeConversationForkScript');
assert.equal(insights.FORK_SCRIPT_SRC, '/conversation-fork.js');

const appended = [];
const knownIds = new Set();
const documentRef = {
  head: { append(node) { appended.push(node); knownIds.add(node.id); } },
  getElementById(id) { return knownIds.has(id) ? { id } : null; },
  createElement(tag) { return { tagName: tag.toUpperCase(), id: '', src: '', async: true }; }
};
assert.equal(insights.installConversationForkAsset(documentRef), true);
assert.equal(appended.length, 1);
assert.equal(appended[0].tagName, 'SCRIPT');
assert.equal(appended[0].id, insights.FORK_SCRIPT_ID);
assert.equal(appended[0].src, '/conversation-fork.js');
assert.equal(appended[0].async, false);
assert.equal(insights.installConversationForkAsset(documentRef), false, 'loader must be idempotent');
assert.equal(appended.length, 1);

assert.equal(swPolicy.CURRENT_CACHE, 'hafize-shell-v94');
assert.equal(swPolicy.SHELL_ASSETS.includes('/conversation-fork.js'), true);
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/conversation-fork.js',
  mode: 'same-origin',
  headers: { get() { return ''; } }
}, 'https://hafize.example'), 'shell');
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/api/chat',
  mode: 'same-origin',
  headers: { get() { return ''; } }
}, 'https://hafize.example'), 'network-only');
assert.equal(swPolicy.classifyRequest({
  method: 'POST',
  url: 'https://hafize.example/api/chat',
  headers: { get() { return ''; } }
}, 'https://hafize.example'), 'ignore');

const forkSource = await readFile(new URL('../public/conversation-fork.js', import.meta.url), 'utf8');
const forbiddenForkCalls = [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /EventSource/,
  /sendBeacon/,
  /requestSubmit\s*\(/,
  /\.submit\s*\(/,
  /#sendBtn[^\n]{0,120}\.click\s*\(/,
  /document\.cookie/,
  /sessionStorage/,
  /indexedDB/i,
  /navigator\.clipboard/,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/
];
for (const pattern of forbiddenForkCalls) {
  assert.equal(pattern.test(forkSource), false, `forbidden fork surface matched ${pattern}`);
}
assert.equal(forkSource.includes("role === 'assistant'"), true);
assert.equal(forkSource.includes("send?.classList?.contains('streaming')"), true);
assert.equal(forkSource.includes("input.value.trim()"), true);
assert.equal(forkSource.includes('guard.sanitizeStoredValue'), true);
assert.equal(forkSource.includes('guard.normalizeConversations'), true);
assert.equal(forkSource.includes("storage.setItem(STORAGE_KEY"), true);
assert.equal(forkSource.includes('copyModelPreference'), true);

const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));
assert.equal(registry.agents.length, 4);
assert.equal(registry.policy?.externalWritesRequireApproval, true);
assert.equal(registry.policy?.secretsNeverEnterAgentContext, true);
assert.equal(registry.policy?.sharedTraceIdRequired, true);
for (const agent of registry.agents) assert.equal(agent.toolPolicy?.denyByDefault, true);

console.log('conversation fork wiring tests passed');
