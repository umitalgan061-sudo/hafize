import assert from 'node:assert/strict';
import { loadPublicModule } from './public-module.mjs';
const { filterItems, sortItems, safeState, normalizeCollection, collectTags } = loadPublicModule('prompt-library.js');

// `createdAt` is pinned on purpose: without it every fixture falls back to the
// current timestamp and the created-desc ordering below becomes a coin flip.
const items = normalizeCollection([
  { id: '1', title: 'Kod yardımcı', body: 'typescript hata analizi', tags: ['Kod'], favorite: false, createdAt: '2026-09-10', updatedAt: '2026-09-12' },
  { id: '2', title: 'Araştırma', body: 'kaynak karşılaştırma', tags: ['Araştırma'], favorite: true, createdAt: '2026-09-11', updatedAt: '2026-09-13' },
  { id: '3', title: 'Plan', body: 'haftalık hedef', tags: ['plan'], favorite: true, createdAt: '2026-09-12', updatedAt: '2026-09-14' }
]);
assert.equal(filterItems(items, safeState({ query: 'typescript' })).length, 1);
assert.equal(filterItems(items, safeState({ query: 'kod' }))[0].id, '1');
assert.equal(filterItems(items, safeState({ tag: 'Kod' })).length, 1);
assert.equal(filterItems(items, safeState({ favoriteOnly: true })).length, 2);
assert.equal(sortItems(items, 'title-asc')[0].title, 'Araştırma');
assert.equal(sortItems(items, 'created-desc')[0].id, '3');
assert.equal(sortItems(items, 'favorite-first')[0].favorite, true);
assert.deepEqual(collectTags(items), ['Araştırma', 'Kod', 'plan']);
assert.equal(filterItems(items, safeState({ query: 'yok' })).length, 0);
console.log('test-prompt-library-search: ok');
