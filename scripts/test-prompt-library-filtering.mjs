import assert from 'node:assert/strict';
import { filterItems, safeState, sortItems, normalizeCollection } from '../public/prompt-library.js';

const items = normalizeCollection([
  { id: '1', title: 'Kod yardımcı', body: 'typescript hata analizi', tags: ['Kod'], favorite: false, updatedAt: '2026-09-12' },
  { id: '2', title: 'Araştırma', body: 'kaynakları karşılaştır', tags: ['Araştırma'], favorite: true, updatedAt: '2026-09-13' },
  { id: '3', title: 'Plan', body: 'haftalık hedef', tags: ['plan'], favorite: true, updatedAt: '2026-09-14' }
]);
assert.equal(filterItems(items, safeState({ query: 'typescript' })).length, 1);
assert.equal(filterItems(items, safeState({ tag: 'Kod' })).length, 1);
assert.equal(filterItems(items, safeState({ favoriteOnly: true })).length, 2);
assert.equal(sortItems(items, 'title-asc')[0].title, 'Araştırma');
assert.equal(sortItems(items, 'favorite-first')[0].favorite, true);
assert.equal(filterItems(items, safeState({ query: 'yok' })).length, 0);
console.log('test-prompt-library-filtering: ok');
