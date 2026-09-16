import assert from 'node:assert/strict';
import { loadPublicModule } from './public-module.mjs';
const { LIMITS, normalizeImportedPayload, mergeImportedItems, exportPayload } = loadPublicModule('prompt-library.js');

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
const json = exportPayload(merged.items);
const parsed = JSON.parse(json);
assert.equal(parsed.version, 1);
assert.equal(parsed.source, 'hafize-prompt-library');
assert.ok(parsed.exportedAt);
assert.equal(Array.isArray(parsed.items), true);
assert.ok(json.length <= LIMITS.maxExport);
console.log('test-prompt-library-import-export: ok');
