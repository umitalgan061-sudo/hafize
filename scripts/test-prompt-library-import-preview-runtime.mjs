// Drives the real import preview against stubbed storage. The point of the
// preview is that the numbers it shows are the numbers the import would
// produce, so the summary is asserted against an actual merge.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createStorageStub } from './browser-storage-stub.mjs';

const require = createRequire(import.meta.url);

const storage = createStorageStub();
globalThis.localStorage = storage;

function load(path, globalName) {
  const exported = require(path);
  const api = exported && Object.keys(exported).length ? exported : globalThis[globalName];
  globalThis[globalName] = api;
  return api;
}

const library = load('../public/prompt-library.js', 'HafizePromptLibrary');
const preview = load('../public/prompt-library-import-preview.js', 'HafizePromptImportPreview');
assert.ok(library && preview, 'both modules expose their APIs');
assert.equal(preview.MAX_FILE, 1000000, 'the file bound matches the core library import limit');
assert.equal(preview.MAX_FILE, library.LIMITS.maxImport, 'and is the same bound, not a second opinion');

const prompt = (id, title = `Başlık ${id}`) => ({
  id,
  title,
  body: `gövde ${id}`,
  tags: [],
  favorite: false,
  useCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
});

const normalize = (items) => library.normalizeCollection(items);

/* An empty file imports nothing ---------------------------------------- */

let summary = preview.describeMerge(normalize([prompt('a')]), normalize([]));
assert.equal(summary.imported, 0);
assert.equal(summary.duplicates, 0);
assert.equal(summary.dropped, 0);
assert.deepEqual(summary.items.map((item) => item.id), ['a'], 'the current library is returned unchanged');

/* A clean file imports every record ------------------------------------ */

summary = preview.describeMerge(normalize([prompt('a')]), normalize([prompt('b'), prompt('c')]));
assert.equal(summary.imported, 2);
assert.equal(summary.duplicates, 0);
assert.equal(summary.dropped, 0);
assert.deepEqual(summary.items.map((item) => item.id), ['a', 'b', 'c']);

/* A repeated id is re-keyed, never overwritten ------------------------- */

const current = normalize([prompt('a', 'Mevcut')]);
summary = preview.describeMerge(current, normalize([prompt('a', 'Yedekten')]));
assert.equal(summary.duplicates, 1, 'the collision is reported before the user confirms');
assert.equal(summary.imported, 1, 'and the record is still imported');
assert.equal(summary.items.length, 2);
assert.equal(summary.items[0].title, 'Mevcut', 'the existing prompt keeps its title');
assert.ok(summary.items.some((item) => item.title === 'Yedekten' && item.id !== 'a'), 'the imported one arrives under a new id');

/* Capacity overflow is reported, not silently dropped ------------------ */

const capacity = library.LIMITS.maxItems;
const full = normalize(Array.from({ length: capacity }, (_, index) => prompt(`p-${index}`)));
assert.equal(full.length, capacity, 'the fixture really is a full library');
summary = preview.describeMerge(full, normalize([prompt('new-1'), prompt('new-2')]));
assert.equal(summary.imported, 0, 'a full library imports nothing');
assert.equal(summary.dropped, 2, 'and the user is told how many records did not fit');
assert.equal(summary.items.length, capacity);

const nearlyFull = normalize(Array.from({ length: capacity - 1 }, (_, index) => prompt(`p-${index}`)));
summary = preview.describeMerge(nearlyFull, normalize([prompt('new-1'), prompt('new-2')]));
assert.equal(summary.imported, 1, 'only what fits is imported');
assert.equal(summary.dropped, 1);
assert.equal(summary.items.length, capacity);

/* The preview never writes --------------------------------------------- */

storage.clear();
storage.setItem(library.STORAGE_KEY, JSON.stringify([prompt('a')]));
const before = storage.snapshot();
preview.describeMerge(library.loadItems(storage), normalize([prompt('b'), prompt('c')]));
assert.deepEqual(storage.snapshot(), before, 'describing a merge leaves storage untouched');

/* Payload shapes the core library accepts ------------------------------ */

const fromArray = library.normalizeImportedPayload([prompt('x')]);
const fromEnvelope = library.normalizeImportedPayload({ source: 'hafize-prompt-library', exportedAt: '2026-01-01', items: [prompt('x')] });
assert.equal(fromArray.items.length, 1, 'a bare array is a valid backup');
assert.equal(fromEnvelope.items.length, 1, 'so is the exported envelope');
assert.equal(fromEnvelope.meta.source, 'hafize-prompt-library', 'whose metadata reaches the summary line');
assert.equal(library.normalizeImportedPayload('nonsense').items.length, 0, 'anything else imports nothing');

console.log('prompt library import preview runtime: ok');
