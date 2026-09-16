import assert from 'node:assert/strict';
// public/prompt-library.js is a browser UMD bundle: it assigns `module.exports`
// at runtime, which Node cannot statically analyse into named exports, so the
// suite takes the default (CommonJS) export and destructures it.
import promptLibrary from '../public/prompt-library.js';
const { LIMITS, normalizeImportedPayload, mergeImportedItems, exportPayload } = promptLibrary;

const payload = normalizeImportedPayload({ version: 1, source: 'fixture', exportedAt: '2026-09-14', items: [
  { id: 'a', title: 'A', body: 'first' },
  { id: 'a', title: 'B', body: 'second' },
  { id: 'b', title: 'C', body: 'third' }
] });
assert.equal(payload.items.length, 2);
assert.equal(payload.meta.source, 'fixture');
const merged = mergeImportedItems([{ id: 'a', title: 'local', body: 'keep' }], payload.items);
assert.equal(merged.imported, 2);
assert.equal(merged.items.length, 3);
assert.equal(merged.items[0].body, 'keep');
assert.equal(new Set(merged.items.map((item) => item.id)).size, 3);
// A library at capacity imports nothing and says so: appending past the limit
// and trimming afterwards used to report a prompt that never landed.
const full = Array.from({ length: LIMITS.maxItems }, (_, index) => ({ id: `id-${index}`, title: `T${index}`, body: 'gövde' }));
const overflow = mergeImportedItems(full, [{ id: 'new', title: 'Yeni', body: 'gövde' }]);
assert.equal(overflow.imported, 0);
assert.equal(overflow.items.length, LIMITS.maxItems);
assert.equal(overflow.items.some((item) => item.id === 'new'), false);
const almost = mergeImportedItems(full.slice(0, LIMITS.maxItems - 1), [
  { id: 'new-1', title: 'Yeni 1', body: 'gövde' },
  { id: 'new-2', title: 'Yeni 2', body: 'gövde' }
]);
assert.equal(almost.imported, 1, 'only what fits is counted as imported');
assert.equal(almost.items.length, LIMITS.maxItems);

const json = exportPayload(merged.items);
const parsed = JSON.parse(json);
assert.equal(parsed.version, 1);
assert.equal(parsed.source, 'hafize-prompt-library');
assert.ok(parsed.exportedAt);
assert.equal(Array.isArray(parsed.items), true);
assert.ok(json.length <= LIMITS.maxExport);
console.log('test-prompt-library-import-export: ok');
