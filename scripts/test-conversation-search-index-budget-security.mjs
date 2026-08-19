import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const search = require('../public/conversation-search.js');
const source = await readFile(new URL('../public/conversation-search.js', import.meta.url), 'utf8');

assert.match(source, /const separatorChars = parts\.length \? 1 : 0/);
assert.match(source, /MAX_INDEXED_CONVERSATION_CHARS - conversationChars - separatorChars/);
assert.match(source, /MAX_INDEXED_TOTAL_CHARS - totalChars - separatorChars/);
assert.match(source, /if \(separatorChars\) \{[\s\S]*conversationChars \+= separatorChars;[\s\S]*totalChars \+= separatorChars;/);

const canary = search.buildCanonicalIndex([{
  id: 'safe',
  title: 'normal',
  ownerId: 'OWNER_SECRET',
  traceId: 'TRACE_SECRET',
  accessToken: 'ACCESS_SECRET',
  messages: [
    { role: 'user', content: 'allowed content' },
    { role: 'tool', content: 'TOOL_SECRET' },
    { role: 'system', content: 'SYSTEM_SECRET' }
  ]
}]).get('safe');
assert.match(canary, /allowed content/);
assert.doesNotMatch(canary, /OWNER_SECRET|TRACE_SECRET|ACCESS_SECRET|TOOL_SECRET|SYSTEM_SECRET/);

for (const forbidden of [
  'fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon',
  'document.cookie', 'sessionStorage', 'indexedDB', 'navigator.clipboard',
  'child_process', 'exec(', 'spawn(', 'shell:'
]) {
  assert.equal(source.includes(forbidden), false, `forbidden search index surface: ${forbidden}`);
}

assert.equal(search.MAX_INDEXED_CONVERSATION_CHARS, 120_000);
assert.equal(search.MAX_INDEXED_TOTAL_CHARS, 1_200_000);
assert.equal(search.MAX_INDEXED_CONVERSATIONS, 30);

console.log('conversation search index budget security tests passed');
