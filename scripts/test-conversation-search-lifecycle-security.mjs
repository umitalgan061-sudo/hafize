import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/conversation-search.js', import.meta.url), 'utf8');

assert.match(source, /input\.addEventListener\('input', onInput\)/);
assert.match(source, /input\.removeEventListener\?\.\('input', onInput\)/);
assert.match(source, /input\.addEventListener\('keydown', onInputKeydown\)/);
assert.match(source, /input\.removeEventListener\?\.\('keydown', onInputKeydown\)/);
assert.match(source, /clearButton\.addEventListener\('click', onClearClick\)/);
assert.match(source, /clearButton\.removeEventListener\?\.\('click', onClearClick\)/);
assert.match(source, /if \(destroyed \|\| refreshQueued\) return/);
assert.match(source, /if \(!destroyed\) refreshAndApply\(\)/);
assert.match(source, /if \(ownsControl\) control\?\.remove\?\.\(\)/);
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
