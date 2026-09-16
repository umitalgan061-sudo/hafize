import assert from 'node:assert/strict';
import { loadBrowserApi } from './browser-module-harness.mjs';

// prompt-library.js is a browser IIFE that publishes its API on the global
// object, so Node cannot statically detect named exports from it. The harness
// evaluates the shipped file and hands back the same API.
const { api: promptLibrary } = loadBrowserApi('prompt-library.js', 'HafizePromptLibrary');
const { LIMITS, normalizeItem, normalizeCollection, safeState } = promptLibrary;

const item = normalizeItem({
  title: '  Başlık  ',
  body: '  İçerik\0\n  ',
  tags: ['Kod', 'kod', '', 'İş'],
  favorite: true,
  useCount: 7,
  createdAt: '2026-09-14T00:00:00.000Z',
  updatedAt: '2026-09-14T01:00:00.000Z'
});
assert.equal(item.title, 'Başlık');
assert.equal(item.body.includes('\0'), false);
assert.equal(item.favorite, true);
assert.equal(item.useCount, 7);
assert.deepEqual(item.tags, ['Kod', 'İş']);

const fallback = normalizeItem({ title: '', body: 'x', favorite: 1, useCount: -5 });
assert.equal(fallback.title, 'İsimsiz istem');
assert.equal(fallback.favorite, false);
assert.equal(fallback.useCount, 0);

assert.equal(normalizeItem({ title: 'x', body: '' }), null);
assert.equal(normalizeItem(null), null);
assert.equal(normalizeCollection(null).length, 0);
assert.equal(normalizeCollection([item, item]).length, 1);
assert.equal(normalizeCollection(Array.from({ length: LIMITS.maxItems + 2 }, (_, i) => ({ id: String(i), title: String(i), body: 'x' }))).length, LIMITS.maxItems);

const state = safeState({ query: '  kod  ', tag: 'Kod', favoriteOnly: true, sort: 'title-asc' });
assert.deepEqual(state, { query: 'kod', tag: 'Kod', favoriteOnly: true, sort: 'title-asc' });
assert.equal(safeState({ sort: 'not-valid' }).sort, 'updated-desc');
assert.equal(safeState({ query: 'x'.repeat(999) }).query.length, LIMITS.maxQuery);
console.log('test-prompt-library-policy: ok');
