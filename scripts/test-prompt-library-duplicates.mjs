import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
// public/prompt-library.js is only a loader for the built bundle; the module
// itself lives in public/typed/prompt-library.ts and assigns `module.exports`
// at runtime, so the suite requires it and destructures the CommonJS export.
const require = createRequire(import.meta.url);
const promptLibrary = require('../public/typed/prompt-library.ts');
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
