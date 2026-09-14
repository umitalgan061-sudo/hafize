import assert from 'node:assert/strict';
import { LIMITS, normalizeItem, normalizeCollection, safeState, extractVariables, replaceVariables, collectTags, filterItems, sortItems } from '../public/prompt-library.js';

assert.equal(LIMITS.MAX_ITEMS, 120);
assert.equal(LIMITS.MAX_BODY, 8000);
assert.equal(LIMITS.MAX_VARIABLES, 12);
assert.equal(normalizeItem({ title: '  Deneme  ', body: 'Merhaba' }).title, 'Deneme');
assert.equal(normalizeItem({ title: 'x', body: '' }), null);
assert.equal(normalizeItem({ title: 'x', body: 'ok', favorite: 1 }).favorite, false);
assert.deepEqual(normalizeItem({ title: 'x', body: 'ok', tags: ['kod', 'kod', '', 4] }).tags, ['kod']);
assert.deepEqual(extractVariables('A {{konu}} B {{ dil }} C {{konu}}'), ['konu', 'dil']);
assert.equal(replaceVariables('Merhaba {{konu}}', { konu: 'Ankara' }), 'Merhaba Ankara');
assert.deepEqual(safeState({ query: ' abc ', tag: 'kod', favoriteOnly: true, sort: 'title-asc' }), { query: 'abc', tag: 'kod', favoriteOnly: true, sort: 'title-asc' });
assert.equal(safeState({ sort: 'unknown' }).sort, 'updated-desc');
const items = normalizeCollection([
  { id: '1', title: 'B', body: 'kodlama', tags: ['Kod'], updatedAt: '2026-01-02' },
  { id: '2', title: 'A', body: 'araştırma', tags: ['Araştırma'], updatedAt: '2026-01-03', favorite: true }
]);
assert.deepEqual(collectTags(items), ['Araştırma', 'Kod']);
assert.equal(filterItems(items, safeState({ query: 'kod' }))[0].id, '1');
assert.equal(sortItems(items, 'title-asc')[0].title, 'A');
console.log('test-prompt-library-policy: ok');
