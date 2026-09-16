// Behaviour contract for the Prompt Library import preview.
//
// The panel's promise is that the numbers it shows are the numbers the merge
// produces, so the plan is computed here against the real library core and
// compared with what `mergeImportedItems` actually returns.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createStorageStub } from './browser-storage-stub.mjs';

const require = createRequire(import.meta.url);

const storage = createStorageStub();
globalThis.localStorage = storage;
const library = require('../public/prompt-library.js');
globalThis.HafizePromptLibrary = library;
const preview = require('../public/prompt-library-import-preview.js');

const prompt = (id, title = `İstem ${id}`) => ({
  id,
  title,
  body: 'gövde {{konu}}',
  tags: ['etiket'],
  favorite: false,
  useCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
});

const backup = (items) => ({ version: 1, source: 'hafize-prompt-library', exportedAt: '2026-02-01T00:00:00.000Z', items });

/* The file limit matches the library's own import limit -------------------- */

assert.equal(preview.MAX_FILE, library.LIMITS.maxImport, 'the preview rejects exactly what the library would');

/* Both backup shapes are counted ------------------------------------------- */

assert.equal(preview.rawCount(backup([prompt('a'), prompt('b')])), 2);
assert.equal(preview.rawCount([prompt('a')]), 1, 'a bare array is a valid backup');
for (const hostile of [null, undefined, 42, 'metin', {}, { items: 'dizi değil' }]) {
  assert.equal(preview.rawCount(hostile), 0, 'a malformed payload counts as empty');
}

/* An empty file offers nothing to import ----------------------------------- */

const empty = preview.planImport([], backup([]));
assert.equal(empty.total, 0);
assert.equal(empty.imported, 0, 'nothing to import keeps the confirm button disabled');
assert.deepEqual(empty.samples, []);

/* Unreadable records are reported as skipped, not imported ------------------ */

const partial = preview.planImport([], backup([prompt('a'), { id: 'x', title: '', body: '' }, null]));
assert.equal(partial.total, 3);
assert.equal(partial.valid, 1);
assert.equal(partial.skipped, 2, 'records the normaliser drops are visible in the summary');
assert.equal(partial.imported, 1);

/* A repeated id is re-keyed, and the existing prompt is left alone ---------- */

const current = library.normalizeCollection([prompt('same', 'Mevcut kayıt')]);
const collision = preview.planImport(current, backup([prompt('same', 'Yedekten gelen')]));
assert.equal(collision.rekeyed, 1, 'the colliding id is reported before anything is written');
assert.equal(collision.imported, 1);
assert.equal(collision.items.length, 2, 'both prompts survive the merge');
const kept = collision.items.find((item) => item.id === 'same');
assert.equal(kept.title, 'Mevcut kayıt', 'the existing prompt keeps its own content');
assert.equal(collision.items.filter((item) => item.title === 'Yedekten gelen').length, 1, 'the imported prompt is kept under a new id');
assert.equal(new Set(collision.items.map((item) => item.id)).size, 2, 'ids stay unique');

/* The plan agrees with the merge the library performs ---------------------- */

const merged = library.mergeImportedItems(current, library.normalizeImportedPayload(backup([prompt('b'), prompt('c')])).items);
const plan = preview.planImport(current, backup([prompt('b'), prompt('c')]));
assert.equal(plan.imported, merged.imported, 'the preview reports the merge it will run');
assert.deepEqual(plan.items.map((item) => item.id), merged.items.map((item) => item.id));

/* Capacity overflow is shown instead of silently dropping prompts ---------- */

const full = library.normalizeCollection(Array.from({ length: library.LIMITS.maxItems }, (_, index) => prompt(`p-${index}`)));
const overflowing = preview.planImport(full, backup([prompt('yeni-1'), prompt('yeni-2')]));
assert.equal(overflowing.valid, 2);
assert.equal(overflowing.imported, 0, 'a full library imports nothing');
assert.equal(overflowing.overflow, 2, 'what does not fit is reported');

/* The sample list is bounded and carries titles, not markup ---------------- */

const many = preview.planImport([], backup(Array.from({ length: 40 }, (_, index) => prompt(`p-${index}`))));
assert.equal(many.samples.length, preview.MAX_SAMPLES, 'the preview list stays bounded');
const hostileTitle = preview.planImport([], backup([prompt('a', '<img src=x onerror=alert(1)>')]));
assert.equal(hostileTitle.samples[0], '<img src=x onerror=alert(1)>', 'a title is carried as text, to be written with textContent');

/* Backup metadata is carried through, bounded ------------------------------ */

assert.equal(preview.planImport([], backup([prompt('a')])).meta.source, 'hafize-prompt-library');
assert.equal(preview.planImport([], [prompt('a')]).meta.source, undefined, 'a bare array has no metadata');

/* Nothing is written while the plan is computed ---------------------------- */

assert.deepEqual(storage.snapshot(), {}, 'planning an import never touches storage');

console.log('prompt library import preview runtime: ok');
