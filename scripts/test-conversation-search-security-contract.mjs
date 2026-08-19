import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const search = require('../public/conversation-search.js');
const source = await readFile(new URL('../public/conversation-search.js', import.meta.url), 'utf8');

for (const forbidden of [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /EventSource/,
  /sendBeacon/,
  /sessionStorage/,
  /indexedDB/i,
  /document\.cookie/,
  /navigator\.clipboard/,
  /innerHTML\s*=/,
  /insertAdjacentHTML/,
  /Authorization/i,
  /Bearer\s+/,
  /ownerId/,
  /traceId/,
  /accessToken/,
  /refreshToken/,
  /apiKey/i,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/
]) {
  assert.doesNotMatch(source, forbidden, `forbidden conversation-search surface: ${forbidden}`);
}

assert.match(source, /sanitizeStoredValue/);
assert.match(source, /MAX_QUERY_CHARS\s*=\s*120/);
assert.match(source, /MAX_INDEXED_CONVERSATIONS\s*=\s*30/);
assert.match(source, /MAX_INDEXED_CONVERSATION_CHARS\s*=\s*120_000/);
assert.match(source, /MAX_INDEXED_TOTAL_CHARS\s*=\s*1_200_000/);
assert.match(source, /\.textContent\s*=/);
assert.doesNotMatch(source, /localStorage\.setItem/);
assert.doesNotMatch(source, /localStorage\.removeItem/);

let reads = 0;
const rootRef = {
  localStorage: {
    getItem(key) {
      reads += 1;
      assert.equal(key, 'hafize.conversations.v1');
      return JSON.stringify([{ id: 'c1', title: 'Safe', messages: [{ role: 'user', content: 'needle' }] }]);
    }
  },
  HafizeConversationStorageGuard: {
    STORAGE_KEY: 'hafize.conversations.v1',
    sanitizeStoredValue(raw) {
      assert.match(raw, /needle/);
      return { value: [{ id: 'c1', title: 'Safe', messages: [{ role: 'user', content: 'needle' }] }] };
    }
  }
};
const result = search.readCanonicalIndex(rootRef);
assert.equal(reads, 1);
assert.equal(result.ready, true);
assert.equal(result.index.get('c1').includes('needle'), true);

console.log('conversation search security contract tests passed');