import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/conversation-search.js', import.meta.url), 'utf8');

assert.match(source, /function addListener\(target, type, listener\)/);
assert.match(source, /target\.addEventListener\(type, listener\)/);
assert.match(source, /listenerCleanup\.push\(\(\) => target\.removeEventListener\(type, listener\)\)/);
assert.match(source, /addListener\(input, 'input', onInput\)/);
assert.match(source, /addListener\(input, 'keydown', onInputKeydown\)/);
assert.match(source, /addListener\(clearButton, 'click', onClearClick\)/);
assert.match(source, /addListener\(rootRef, 'storage', onStorage\)/);
assert.match(source, /addListener\(rootRef, 'hafize:conversation-storage-merged', queueRefresh\)/);
assert.match(source, /if \(!isLive\(\) \|\| scheduledRefresh\) return false/);
assert.match(source, /if \(!isLive\(\) \|\| generation !== refreshGeneration\) return/);
assert.match(source, /cancelScheduledRefresh\(\)/);
assert.match(source, /while \(listenerCleanup\.length\) \{ try \{ listenerCleanup\.pop\(\)\?\.\(\); \} catch \{\} \}/);
assert.match(source, /observer\?\.disconnect\?\.\(\)/);
assert.match(source, /if \(ownsControl\) control\?\.remove\?\.\(\)/);
assert.match(source, /if \(list\) ACTIVE_LISTS\.delete\(list\)/);
assert.match(source, /control = null;[\s\S]*input = null;[\s\S]*clearButton = null;[\s\S]*status = null;[\s\S]*list = null;/);

for (const forbidden of [
  'fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon',
  'document.cookie', 'sessionStorage', 'indexedDB', 'navigator.clipboard',
  'child_process', 'exec(', 'spawn(', 'shell:'
]) {
  assert.equal(source.includes(forbidden), false, `forbidden lifecycle surface: ${forbidden}`);
}

assert.match(source, /HafizeConversationStorageGuard/);
assert.match(source, /message\?\.role !== 'user' && message\?\.role !== 'assistant'/);
assert.equal(source.includes('ownerId'), false);
assert.equal(source.includes('traceId'), false);
assert.equal(source.includes('accessToken'), false);
assert.equal(source.includes('refreshToken'), false);

console.log('conversation search lifecycle security tests passed');
