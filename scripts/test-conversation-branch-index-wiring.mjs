import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [index, shell, policy] = await Promise.all([
  readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../public/ui-shell.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8')
]);

const ordered = [
  '/message-copy.js',
  '/conversation-model-state.js',
  '/conversation-fork.js',
  '/message-edit.js',
  '/response-retry-style.js',
  '/response-retry.js'
];

let previous = -1;
for (const asset of ordered) {
  const indexAt = shell.indexOf(`src: '${asset}'`);
  assert.ok(indexAt >= 0, `${asset} must be installed by ui-shell`);
  assert.ok(indexAt > previous, `${asset} must preserve dependency order`);
  previous = indexAt;
  assert.ok(policy.includes(`'${asset}'`), `${asset} must be PWA shell cached`);
}

assert.match(index, /id="hafizeConversationStorageGuardScript"[^>]+src="\/conversation-storage-guard\.js"[^>]+defer/);
assert.match(index, /src="\/app\.js" defer/);
assert.match(index, /src="\/ui-shell\.js" defer/);
assert.doesNotMatch(index, /src="https?:\/\//i);
assert.doesNotMatch(shell, /https?:\/\//i);
assert.doesNotMatch(shell, /(?:token|secret|credential|api[_-]?key)\s*[:=]/i);
assert.match(shell, /script\.async = false/);
assert.match(shell, /installConversationBranchAssets\(documentRef\)/);

console.log('conversation branch startup wiring contract: ok');
