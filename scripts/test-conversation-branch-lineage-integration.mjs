import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [lineage, fork, edit, shell, policy] = await Promise.all([
  readFile(new URL('../public/conversation-branch-lineage.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/conversation-fork.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/message-edit.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/ui-shell.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8')
]);

for (const producer of [fork, edit]) {
  assert.match(producer, /hafize:conversation-branched/);
  assert.match(producer, /childConversationId:/);
  assert.match(producer, /parentConversationId:/);
  assert.match(producer, /sourceMessageId:/);
  assert.doesNotMatch(producer, /detail:\s*\{[^}]*?(?:content|token|credential|ownerId|traceId)/s);
}
assert.match(fork, /mode:\s*'fork'/);
assert.match(edit, /mode:\s*'edit'/);
assert.match(lineage, /MAX_ENTRIES = 60/);
assert.match(lineage, /hafize\.conversation-branches\.v1/);
assert.doesNotMatch(lineage, /fetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/);
assert.doesNotMatch(lineage, /document\.cookie|sessionStorage|indexedDB|clipboard/i);
assert.doesNotMatch(lineage, /innerHTML|insertAdjacentHTML|eval\(|new Function/);
assert.doesNotMatch(lineage, /ownerId|traceId|credential|accessToken|refreshToken/);
assert.match(shell, /conversation-branch-lineage\.js/);
assert.match(policy, /conversation-branch-lineage\.js/);
assert.match(policy, /const CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);

console.log('conversation branch lineage integration contract: ok');
