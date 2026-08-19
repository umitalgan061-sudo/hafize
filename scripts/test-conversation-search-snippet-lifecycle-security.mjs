import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/conversation-search-snippets.js', import.meta.url), 'utf8');

assert.match(source, /if \(!mounted \|\| destroyed \|\| !input \|\| !list\)/);
assert.match(source, /if \(!mounted \|\| destroyed \|\| queued\) return/);
assert.match(source, /if \(mounted && !destroyed\) apply\(\)/);
assert.match(source, /if \(mounted\) return false/);
assert.match(source, /input\?\.removeEventListener\?\.\('input', queueApply\)/);
assert.match(source, /input = null;[\s\S]*list = null;[\s\S]*queued = false;[\s\S]*mounted = false;/);

for (const forbidden of [
  'fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon',
  'document.cookie', 'sessionStorage', 'indexedDB', 'navigator.clipboard',
  'child_process', 'exec(', 'spawn(', 'shell:'
]) {
  assert.equal(source.includes(forbidden), false, `forbidden snippet lifecycle surface: ${forbidden}`);
}

assert.match(source, /HafizeConversationStorageGuard/);
assert.match(source, /message\?\.role !== 'user' && message\?\.role !== 'assistant'/);
assert.equal(source.includes('ownerId'), false);
assert.equal(source.includes('traceId'), false);
assert.equal(source.includes('accessToken'), false);
assert.equal(source.includes('refreshToken'), false);

console.log('conversation search snippet lifecycle security tests passed');
