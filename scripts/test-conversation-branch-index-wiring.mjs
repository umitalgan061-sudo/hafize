import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [index, policy] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8')
]);

const ordered = [
  '/conversation-storage-guard.js',
  '/chat-run-controller.js',
  '/app.js',
  '/message-copy.js',
  '/conversation-model-state.js',
  '/conversation-fork.js',
  '/message-edit.js',
  '/response-retry-style.js',
  '/response-retry.js'
];

let previous = -1;
for (const asset of ordered) {
  const needle = `src="${asset}"`;
  const indexAt = index.indexOf(needle);
  assert.ok(indexAt >= 0, `${asset} must be executed by index.html`);
  assert.ok(indexAt > previous, `${asset} must preserve dependency order`);
  previous = indexAt;
  assert.match(policy, new RegExp(`['\"]${asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['\"]`), `${asset} must be PWA shell cached`);
}

assert.match(policy, /hafize-shell-v98/);
assert.doesNotMatch(index, /src="https?:\/\//i);
assert.doesNotMatch(index, /<script[^>]+(?:token|secret|credential|api[_-]?key)/i);
assert.match(index, /id="hafizeConversationStorageGuardScript"[^>]+defer/);

const responseStyle = index.indexOf('src="/response-retry-style.js"');
const responseRuntime = index.indexOf('src="/response-retry.js"');
assert.ok(responseStyle < responseRuntime, 'response retry stylesheet loader must execute before runtime');

console.log('conversation branch startup wiring contract: ok');
