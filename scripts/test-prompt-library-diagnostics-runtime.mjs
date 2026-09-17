// Drives the real diagnostics module against stubbed storage instead of
// asserting on its source text: a health report that cannot see a broken record
// is worse than no health panel at all.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createStorageStub, createThrowingStorage } from './browser-storage-stub.mjs';

const require = createRequire(import.meta.url);
const PROMPT_KEY = 'hafize.prompt-library.v1';
const COLLECTION_KEY = 'hafize.prompt-library.collections.v1';

const storage = createStorageStub();
globalThis.localStorage = storage;
// Some modules publish through CommonJS under `require` and some straight onto
// the global. The diagnostics module looks the other two up on the global at
// call time, so each one is published there the way the browser publishes it.
function load(path, globalName) {
  const exported = require(path);
  const api = exported && Object.keys(exported).length ? exported : globalThis[globalName];
  globalThis[globalName] = api;
  return api;
}

const library = load('../public/prompt-library.js', 'HafizePromptLibrary');
const collections = load('../public/prompt-library-collections.js', 'HafizePromptLibraryCollections');
const diagnostics = load('../public/prompt-library-diagnostics.js', 'HafizePromptLibraryDiagnostics');
assert.ok(diagnostics && library && collections, 'the three modules expose their APIs');
assert.equal(collections.STORAGE_KEY, COLLECTION_KEY, 'the collection key is the one this suite seeds');

const prompt = (id, body = 'gövde') => ({
  id,
  title: `Başlık ${id}`,
  body,
  tags: [],
  favorite: false,
  useCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
});

/* An empty device is healthy, not broken ------------------------------- */

storage.clear();
let report = diagnostics.inspect(storage);
assert.equal(report.records, 0);
assert.equal(diagnostics.healthy(report), true, 'a device that has never stored a prompt reports healthy');

/* A well-formed library is healthy ------------------------------------- */

storage.setItem(PROMPT_KEY, JSON.stringify([prompt('a'), prompt('b')]));
storage.setItem(COLLECTION_KEY, JSON.stringify([
  { id: 'c1', name: 'Koleksiyon', description: '', color: 'default', promptIds: ['a'], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
]));
report = diagnostics.inspect(storage);
assert.equal(report.records, 2);
assert.equal(report.normalized, 2);
assert.equal(report.collections, 1);
assert.equal(report.orphans.length, 0);
assert.equal(diagnostics.healthy(report), true);

/* Every kind of damage is reported separately -------------------------- */

storage.setItem(PROMPT_KEY, JSON.stringify([
  prompt('a'),
  prompt('a'), // repeated id
  { id: 'c' }, // no body: not normalizable
  null,
  prompt('d')
]));
storage.setItem(COLLECTION_KEY, JSON.stringify([
  { id: 'c1', name: 'Koleksiyon', description: '', color: 'default', promptIds: ['a', 'gone', 'also-gone'], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
]));
report = diagnostics.inspect(storage);
assert.equal(report.records, 5, 'the raw record count is what the key holds');
assert.equal(report.broken, 2, 'a record with no body and a null entry are both broken');
assert.equal(report.duplicates, 1, 'the repeated id is counted once');
assert.deepEqual(report.orphans.map((entry) => entry.promptId), ['gone', 'also-gone']);
assert.equal(diagnostics.healthy(report), false);

/* A non-array root is a different failure than a broken record --------- */

storage.setItem(PROMPT_KEY, JSON.stringify({ items: [prompt('a')] }));
report = diagnostics.inspect(storage);
assert.equal(report.rootValid, false, 'an object root is reported as an invalid root');
assert.equal(report.records, 0, 'and yields no records rather than throwing');
assert.equal(diagnostics.healthy(report), false);

storage.setItem(PROMPT_KEY, '{not json');
report = diagnostics.inspect(storage);
assert.equal(report.rootValid, false, 'unparseable storage is an invalid root, not a crash');

storage.setItem(PROMPT_KEY, JSON.stringify([prompt('a')]));
storage.setItem(COLLECTION_KEY, JSON.stringify({ collections: [] }));
report = diagnostics.inspect(storage);
assert.equal(report.rootValid, true);
assert.equal(report.collectionRootValid, false, 'the two roots are reported independently');

/* The report stays bounded on hostile data ----------------------------- */

const many = Array.from({ length: diagnostics.MAX_RECORDS + 40 }, (_, index) => prompt(`p-${index}`));
storage.setItem(PROMPT_KEY, JSON.stringify(many));
storage.setItem(COLLECTION_KEY, JSON.stringify([
  {
    id: 'c1',
    name: 'Koleksiyon',
    description: '',
    color: 'default',
    promptIds: Array.from({ length: 400 }, (_, index) => `missing-${index}`),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
]));
report = diagnostics.inspect(storage);
assert.equal(report.records, many.length, 'the raw count is not clipped, so the user sees the real size');
assert.equal(report.normalized, diagnostics.MAX_RECORDS, 'but only the bounded window is normalized');
assert.equal(report.truncated, true);
assert.ok(report.orphans.length <= diagnostics.MAX_ORPHANS, 'the orphan list is bounded');

/* Repair narrows to what the normalizers accept ------------------------ */

storage.setItem(PROMPT_KEY, JSON.stringify([prompt('a'), prompt('a'), { id: 'c' }, prompt('d')]));
storage.setItem(COLLECTION_KEY, JSON.stringify([
  { id: 'c1', name: 'Koleksiyon', description: '', color: 'default', promptIds: ['a', 'gone'], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
]));
assert.equal(diagnostics.repair(storage), true);
report = diagnostics.inspect(storage);
assert.equal(diagnostics.healthy(report), true, 'the library is healthy after a repair');
assert.deepEqual(library.loadItems(storage).map((item) => item.id), ['a', 'd'], 'the duplicate and the unusable record are gone');
assert.deepEqual(collections.readCollections(storage)[0].promptIds, ['a'], 'the orphan member is gone and the real one is kept');

// Repairing twice is a no-op rather than a second narrowing.
const after = storage.getItem(PROMPT_KEY);
assert.equal(diagnostics.repair(storage), true);
assert.equal(storage.getItem(PROMPT_KEY), after);

/* Blocked storage degrades instead of throwing ------------------------- */

const blocked = createThrowingStorage(['getItem', 'setItem']);
report = diagnostics.inspect(blocked);
assert.equal(report.rootValid, false, 'storage that throws is reported as an invalid root');
assert.equal(diagnostics.repair(blocked), false, 'and a repair reports failure rather than throwing');

console.log('prompt library diagnostics runtime: ok');
