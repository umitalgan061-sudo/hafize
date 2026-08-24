import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/conversation-search-snippets.js', import.meta.url), 'utf8');

assert.match(source, /function isLive\(\) \{[\s\S]*return mounted && !destroyed && list && ACTIVE_LISTS\.has\(list\)/);
assert.match(source, /function addListener\(target, type, listener\)/);
assert.match(source, /target\.addEventListener\(type, listener\)/);
assert.match(source, /listenerCleanup\.push\(\(\) => target\.removeEventListener\(type, listener\)\)/);
assert.match(source, /if \(!isLive\(\) \|\| !input\) return Object\.freeze/);
assert.match(source, /if \(!isLive\(\) \|\| queuedHandle != null\) return false/);
assert.match(source, /if \(isLive\(\)\) apply\(\)/);
assert.match(source, /if \(mounted \|\| destroyed\) return false/);
assert.match(source, /if \(!input \|\| !list \|\| ACTIVE_LISTS\.has\(list\)\)/);
assert.match(source, /ACTIVE_LISTS\.add\(list\)/);
assert.match(source, /cancelQueued\(\)/);
assert.match(source, /observer\?\.disconnect\?\.\(\)/);
assert.match(source, /while \(listenerCleanup\.length\)/);
assert.match(source, /if \(list\) ACTIVE_LISTS\.delete\(list\)/);
assert.match(source, /mounted = false;[\s\S]*input = null;[\s\S]*list = null;/);
assert.match(source, /const ownedList = list;[\s\S]*if \(ownedList\) ACTIVE_LISTS\.delete\(ownedList\)/);

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
