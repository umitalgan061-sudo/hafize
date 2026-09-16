// Behavioural contract for the import preview.
//
// The QA matrix in docs/PROMPT_IMPORT_QA.md lists what the user must be able
// to see before confirming an import. These are the data scenarios from that
// list, run against the real module and the real library normalizers.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key)
};

const library = require('../public/prompt-library.js');
globalThis.HafizePromptLibrary = library;
const importPreview = require('../public/prompt-library-import-preview.js');

const prompt = (id, title = `İstem ${id}`) => ({
  id,
  title,
  body: `${title} gövdesi`,
  tags: [],
  favorite: false,
  useCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z'
});

/* 1. An empty backup previews as nothing to import ---------------------- */

let result = importPreview.preview([], []);
assert.equal(result.raw, 0);
assert.equal(result.valid, 0);
assert.equal(result.accepted, 0, 'the confirm button is driven by this being zero');

/* 2/3. Valid records are counted and carried into the sample ------------ */

result = importPreview.preview([prompt('a'), prompt('b'), prompt('c')], []);
assert.equal(result.raw, 3);
assert.equal(result.valid, 3);
assert.equal(result.accepted, 3);
assert.equal(result.invalid, 0);
assert.deepEqual(result.items.map((item) => item.id), ['a', 'b', 'c']);

/* Both export shapes are understood: a bare array and a wrapped payload -- */

const wrapped = { version: 1, source: 'hafize-prompt-library', exportedAt: '2026-02-01T00:00:00.000Z', items: [prompt('a')] };
result = importPreview.preview(wrapped, []);
assert.equal(result.raw, 1);
assert.equal(result.valid, 1);
assert.equal(result.meta.source, 'hafize-prompt-library');
assert.equal(importPreview.rawRecordCount(wrapped), 1);
assert.equal(importPreview.rawRecordCount('nonsense'), 0);

/* Broken records are reported rather than silently dropped -------------- */

result = importPreview.preview([prompt('a'), null, { id: 'x' }, 'metin'], []);
assert.equal(result.raw, 4);
assert.equal(result.valid, 1);
assert.equal(result.invalid, 3, 'the summary tells the user what will be skipped');

/* 4. A repeated id never overwrites the prompt already in the library --- */

const existing = [prompt('a', 'Mevcut başlık')];
result = importPreview.preview([prompt('a', 'Yedekteki başlık')], existing);
assert.equal(result.accepted, 1);
assert.equal(result.merged.length, 2, 'both prompts survive');
assert.equal(result.merged[0].title, 'Mevcut başlık', 'the existing record keeps its values');
assert.notEqual(result.merged[1].id, 'a', 'the imported copy is re-keyed');

/* 5. A full library reports what falls outside the capacity ------------- */

const full = Array.from({ length: library.LIMITS.maxItems }, (_, index) => prompt(`id-${index}`));
result = importPreview.preview([prompt('new-1'), prompt('new-2')], full);
assert.equal(result.valid, 2);
assert.equal(result.accepted, 0);
assert.equal(result.rejected, 2, 'the user sees the records capacity will reject');

const almostFull = full.slice(0, library.LIMITS.maxItems - 1);
result = importPreview.preview([prompt('new-1'), prompt('new-2')], almostFull);
assert.equal(result.accepted, 1);
assert.equal(result.rejected, 1);

/* The preview writes nothing ------------------------------------------- */

assert.equal(storage.size, 0, 'previewing a backup never touches storage');

/* The file ceiling matches the library's own import limit --------------- */

assert.equal(importPreview.MAX_FILE, library.LIMITS.maxImport);
assert.ok(Object.isFrozen(importPreview));

console.log('prompt import preview runtime: ok');
