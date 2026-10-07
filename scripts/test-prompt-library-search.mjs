import assert from 'node:assert/strict';
// public/prompt-library.js is a browser UMD bundle: it assigns `module.exports`
// at runtime, which Node cannot statically analyse into named exports, so the
// suite takes the default (CommonJS) export and destructures it.
import promptLibrary from '../public/typed/prompt-library.ts';
const { filterItems, sortItems, safeState, normalizeCollection, collectTags } = promptLibrary;

const items = normalizeCollection([
  { id: '1', title: 'Kod yardımcı', body: 'typescript hata analizi', tags: ['Kod'], favorite: false, updatedAt: '2026-09-12' },
  { id: '2', title: 'Araştırma', body: 'kaynak karşılaştırma', tags: ['Araştırma'], favorite: true, updatedAt: '2026-09-13' },
  { id: '3', title: 'Plan', body: 'haftalık hedef', tags: ['plan'], favorite: true, updatedAt: '2026-09-14' }
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
