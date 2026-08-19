import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const snippets = require('../public/conversation-search-snippets.js');
const guard = require('../public/conversation-storage-guard.js');

assert.equal(snippets.normalizeQuery('  İMAR   Planı  '), 'imar planı');
assert.equal(snippets.normalizeQuery('x'.repeat(snippets.MAX_QUERY_CHARS + 1)), '');
assert.equal(snippets.normalizeId('conv-1'), 'conv-1');
assert.equal(snippets.normalizeId('../unsafe'), '');

const longText = `${'A'.repeat(120)} hedef ${'B'.repeat(120)}`;
const bounded = snippets.boundedWindow(longText, 'hedef');
assert.ok(bounded.includes('hedef'));
assert.ok(bounded.length <= snippets.MAX_SNIPPET_CHARS + 2);
assert.ok(bounded.startsWith('…'));
assert.ok(bounded.endsWith('…'));
assert.equal(snippets.boundedWindow('eşleşme yok', 'hedef'), '');

const conversations = guard.sanitizeStoredValue(JSON.stringify([
  {
    id: 'conv-1',
    title: 'Ankara',
    ownerId: 'owner-secret-canary',
    traceId: 'trace-secret-canary',
    messages: [
      { id: 'm-1', role: 'user', content: 'İmar planında yeşil alan hedefini ara', createdAt: '2026-08-19T04:00:00.000Z' },
      { id: 'm-2', role: 'assistant', content: 'Hedef bulundu.', createdAt: '2026-08-19T04:00:01.000Z' },
      { id: 'm-3', role: 'system', content: 'system-secret-canary', createdAt: '2026-08-19T04:00:02.000Z' },
      { id: 'm-4', role: 'tool', content: 'tool-secret-canary', createdAt: '2026-08-19T04:00:03.000Z' }
    ]
  },
  {
    id: 'conv-2',
    title: 'Kod',
    messages: [
      { id: 'm-5', role: 'assistant', content: 'SSE backpressure sınırı hazır.', createdAt: '2026-08-19T04:01:00.000Z' }
    ]
  }
])).value;

assert.equal(snippets.firstMessageSnippet(conversations[0], 'hedef'), 'Sen: İmar planında yeşil alan hedefini ara');
assert.equal(snippets.firstMessageSnippet(conversations[1], 'backpressure'), 'Hafize: SSE backpressure sınırı hazır.');
assert.equal(snippets.firstMessageSnippet(conversations[0], 'system-secret-canary'), '');

const index = snippets.buildSnippetIndex(conversations, 'hedef');
assert.equal(index.size, 1);
assert.match(index.get('conv-1'), /^Sen:/);
assert.doesNotMatch(index.get('conv-1'), /owner-secret-canary|trace-secret-canary|system-secret-canary|tool-secret-canary/);

const rootRef = {
  HafizeConversationStorageGuard: guard,
  localStorage: { getItem: () => JSON.stringify(conversations) }
};
assert.equal(snippets.readCanonicalConversations(rootRef).length, 2);
assert.deepEqual(snippets.readCanonicalConversations({ localStorage: rootRef.localStorage }), []);
assert.deepEqual(snippets.readCanonicalConversations({
  HafizeConversationStorageGuard: guard,
  localStorage: { getItem: () => { throw new Error('private-storage-error'); } }
}), []);

console.log('conversation search snippet tests passed');
