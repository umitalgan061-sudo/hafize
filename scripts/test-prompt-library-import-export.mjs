import assert from 'node:assert/strict';
import { LIMITS, normalizeImportedPayload, mergeImportedItems, exportPayload, normalizeCollection } from '../public/prompt-library.js';

const source = normalizeImportedPayload({
  version: 1,
  source: 'fixture',
  exportedAt: '2026-09-14T00:00:00.000Z',
  items: [
    { id: 'same', title: 'Bir', body: 'İlk' },
    { id: 'same', title: 'İki', body: 'İkinci' },
    { id: 'ok', title: 'Üç', body: 'Üçüncü', tags: ['a', 'a'] }
  ]
});
assert.equal(source.items.length, 2);
assert.equal(source.meta.source, 'fixture');
const merged = mergeImportedItems([{ id: 'same', title: 'Var', body: 'Var olan' }], source.items);
assert.equal(merged.imported, 2);
assert.equal(merged.items.length, 3);
assert.notEqual(merged.items[1].id, 'same');
const serialized = exportPayload(merged.items);
const payload = JSON.parse(serialized);
assert.equal(payload.source, 'hafize-prompt-library');
assert.equal(payload.version, 1);
assert.ok(payload.exportedAt);
assert.ok(serialized.length <= LIMITS.MAX_EXPORT);
const huge = normalizeCollection(Array.from({ length: LIMITS.MAX_ITEMS + 30 }, (_v, i) => ({ id: String(i), title: `T${i}`, body: 'x' })));
assert.equal(huge.length, LIMITS.MAX_ITEMS);
console.log('test-prompt-library-import-export: ok');
