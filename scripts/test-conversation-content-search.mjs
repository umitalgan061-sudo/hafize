import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const search = require('../public/conversation-search.js');
const guard = require('../public/conversation-storage-guard.js');

assert.equal(search.normalizeQuery('  İMAR   Planı  '), 'imar planı');
assert.equal(search.normalizeQuery('x'.repeat(search.MAX_QUERY_CHARS + 1)), null);
assert.equal(search.normalizeSearchText('  Bir   Mesaj  ', 100), 'bir mesaj');
assert.equal(search.normalizeSearchText('x'.repeat(101), 100), '');

const raw = JSON.stringify([
  {
    id: 'conv-1',
    title: 'Ankara Planlama',
    ownerId: 'owner-secret-canary',
    traceId: 'trace-secret-canary',
    messages: [
      { id: 'm-1', role: 'user', content: 'İmar planında yeşil alan oranını bul', createdAt: '2026-08-19T03:00:00.000Z' },
      { id: 'm-2', role: 'assistant', content: 'Yeşil alan oranını birlikte inceleyebiliriz.', createdAt: '2026-08-19T03:00:01.000Z' },
      { id: 'm-3', role: 'system', content: 'system-secret-canary', createdAt: '2026-08-19T03:00:02.000Z' },
      { id: 'm-4', role: 'tool', content: 'tool-secret-canary', createdAt: '2026-08-19T03:00:03.000Z' }
    ]
  },
  {
    id: 'conv-2',
    title: 'Kod İncelemesi',
    messages: [
      { id: 'm-5', role: 'user', content: 'SSE backpressure testlerini incele', createdAt: '2026-08-19T03:01:00.000Z' }
    ]
  }
]);

const canonical = guard.sanitizeStoredValue(raw);
assert.equal(canonical.value.length, 2);
const index = search.buildCanonicalIndex(canonical.value);
assert.equal(index.size, 2);
assert.match(index.get('conv-1'), /imar planında yeşil alan/);
assert.match(index.get('conv-1'), /yeşil alan oranını birlikte/);
assert.doesNotMatch(index.get('conv-1'), /system-secret-canary/);
assert.doesNotMatch(index.get('conv-1'), /tool-secret-canary/);
assert.doesNotMatch(index.get('conv-1'), /owner-secret-canary/);
assert.doesNotMatch(index.get('conv-1'), /trace-secret-canary/);

function row(id, title) {
  return {
    dataset: { conversationId: id },
    hidden: false,
    querySelector(selector) {
      return selector === '.conversation-open' ? { textContent: title } : null;
    }
  };
}

const rows = [
  row('conv-1', 'Ankara Planlama'),
  row('conv-2', 'Kod İncelemesi')
];
let result = search.filterRows(rows, 'backpressure', index);
assert.equal(result.ok, true);
assert.equal(result.visible, 1);
assert.equal(rows[0].hidden, true);
assert.equal(rows[1].hidden, false);

result = search.filterRows(rows, 'ankara', index);
assert.equal(result.visible, 1);
assert.equal(rows[0].hidden, false);
assert.equal(rows[1].hidden, true);

result = search.filterRows(rows, '', index);
assert.equal(result.visible, 2);
assert.equal(rows.every((entry) => entry.hidden === false), true);

const malformedRow = row('../unsafe', 'Başlık eşleşmesi');
assert.equal(search.rowConversationId(malformedRow), '');
assert.equal(search.rowMatches(malformedRow, 'başlık', index), true);
assert.equal(search.rowMatches(malformedRow, 'system-secret-canary', index), false);

const rootRef = {
  localStorage: { getItem: () => raw },
  HafizeConversationStorageGuard: guard
};
const loaded = search.readCanonicalIndex(rootRef);
assert.equal(loaded.ready, true);
assert.match(loaded.index.get('conv-2'), /sse backpressure/);

const noGuard = search.readCanonicalIndex({ localStorage: rootRef.localStorage });
assert.equal(noGuard.ready, false);
assert.equal(noGuard.index.size, 0);

const brokenStorage = search.readCanonicalIndex({
  HafizeConversationStorageGuard: guard,
  localStorage: { getItem: () => { throw new Error('private-storage-error'); } }
});
assert.equal(brokenStorage.ready, false);
assert.equal(brokenStorage.index.size, 0);

console.log('conversation content search tests passed');