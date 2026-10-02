import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
// public/prompt-library.js is only a loader for the built bundle; the module
// itself lives in public/typed/prompt-library.ts and assigns `module.exports`
// at runtime, so the suite requires it and destructures the CommonJS export.
const require = createRequire(import.meta.url);
const promptLibrary = require('../public/typed/prompt-library.ts');
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
const json = exportPayload(merged.items);
const parsed = JSON.parse(json);
assert.equal(parsed.version, 1);
assert.equal(parsed.source, 'hafize-prompt-library');
assert.ok(parsed.exportedAt);
assert.equal(Array.isArray(parsed.items), true);
assert.ok(json.length <= LIMITS.maxExport);
console.log('test-prompt-library-import-export: ok');
