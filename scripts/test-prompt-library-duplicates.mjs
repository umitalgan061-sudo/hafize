import assert from 'node:assert/strict';
import { loadBrowserApi } from './browser-module-harness.mjs';

// prompt-library.js is a browser IIFE that publishes its API on the global
// object, so Node cannot statically detect named exports from it. The harness
// evaluates the shipped file and hands back the same API.
const { api: promptLibrary } = loadBrowserApi('prompt-library.js', 'HafizePromptLibrary');
const { mergeImportedItems } = promptLibrary;

const result = mergeImportedItems(
  [{ id: 'fixed', title: 'Yerel', body: 'yerel içerik' }],
  [
    { id: 'fixed', title: 'İçe aktarılan 1', body: 'bir' },
    { id: 'other', title: 'İçe aktarılan 2', body: 'iki' },
    { id: 'fixed', title: 'İçe aktarılan 3', body: 'üç' }
  ]
);
assert.equal(result.imported, 3);
assert.equal(result.items.length, 4);
assert.equal(result.items[0].title, 'Yerel');
assert.equal(new Set(result.items.map((item) => item.id)).size, 4);
assert.equal(result.items.filter((item) => item.id === 'fixed').length, 1);
console.log('test-prompt-library-duplicates: ok');
