import assert from 'node:assert/strict';
import { mergeImportedItems } from '../public/prompt-library.js';

const result = mergeImportedItems(
  [{ id: 'fixed', title: 'Yerel', body: 'Yerel içerik' }],
  [
    { id: 'fixed', title: 'İçe aktarılan', body: 'İçerik 1' },
    { id: 'another', title: 'İkinci', body: 'İçerik 2' },
    { id: 'fixed', title: 'Üçüncü', body: 'İçerik 3' }
  ]
);
assert.equal(result.items.length, 4);
assert.equal(result.imported, 3);
assert.equal(result.items[0].title, 'Yerel');
assert.equal(new Set(result.items.map((item) => item.id)).size, 4);
assert.ok(result.items.slice(1).every((item) => item.id !== 'fixed'));
console.log('test-prompt-library-duplicates: ok');
