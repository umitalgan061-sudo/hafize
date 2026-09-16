// Behaviour contract for the Prompt Library health panel.
//
// The panel is only useful if it agrees with the normalisers the library itself
// uses, so the real `prompt-library.js` and `prompt-library-collections.js`
// modules are loaded here and the diagnostics run against a stubbed storage.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createStorageStub, createThrowingStorage } from './browser-storage-stub.mjs';

const require = createRequire(import.meta.url);

function install(entries) {
  const storage = createStorageStub(entries);
  globalThis.localStorage = storage;
  return storage;
}

const storage = install({});
globalThis.HafizePromptLibrary = require('../public/prompt-library.js');
// The collections module publishes itself on the global instead of exporting.
require('../public/prompt-library-collections.js');
const diagnostics = require('../public/prompt-library-diagnostics.js');
assert.ok(globalThis.HafizePromptLibraryCollections, 'the collections core is installed');

const PROMPT_KEY = globalThis.HafizePromptLibrary.STORAGE_KEY;
const COLLECTION_KEY = globalThis.HafizePromptLibraryCollections.STORAGE_KEY;

const prompt = (id, extra = {}) => ({
  id,
  title: `İstem ${id}`,
  body: 'gövde',
  tags: [],
  favorite: false,
  useCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...extra
});

/* An empty device is healthy, not broken ---------------------------------- */

assert.equal(diagnostics.inspect().healthy, true, 'empty storage is healthy');
assert.equal(diagnostics.inspect().rawCount, 0);

/* A clean library is healthy ---------------------------------------------- */

storage.setItem(PROMPT_KEY, JSON.stringify([prompt('a'), prompt('b')]));
storage.setItem(COLLECTION_KEY, JSON.stringify([
  { id: 'c1', name: 'Koleksiyon', description: '', color: 'default', promptIds: ['a'], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
]));
const clean = diagnostics.inspect();
assert.equal(clean.healthy, true, 'a normalised library reports healthy');
assert.equal(clean.normalized, 2);
assert.equal(clean.broken, 0);
assert.equal(clean.duplicates, 0);
assert.equal(clean.collectionCount, 1);
assert.deepEqual(clean.orphans, []);

/* Damage is counted, not hidden ------------------------------------------- */

storage.setItem(PROMPT_KEY, JSON.stringify([
  prompt('a'),
  prompt('a'),
  { id: 'broken', title: '', body: '' },
  null,
  'metin değil nesne'
]));
storage.setItem(COLLECTION_KEY, JSON.stringify([
  { id: 'c1', name: 'Koleksiyon', description: '', color: 'default', promptIds: ['a', 'silinmiş'], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
]));
const damaged = diagnostics.inspect();
assert.equal(damaged.healthy, false, 'damaged storage is reported');
assert.equal(damaged.rawCount, 5);
assert.equal(damaged.duplicates, 1, 'the repeated id is counted once');
assert.ok(damaged.broken >= 3, 'unreadable records are counted');
assert.deepEqual(damaged.orphans.map((entry) => entry.promptId), ['silinmiş']);

/* A non-array root is reported instead of throwing ------------------------ */

storage.setItem(PROMPT_KEY, JSON.stringify({ items: [prompt('a')] }));
const wrongRoot = diagnostics.inspect();
assert.equal(wrongRoot.rootIsArray, false);
assert.equal(wrongRoot.healthy, false);
assert.equal(wrongRoot.rawCount, 0);

storage.setItem(PROMPT_KEY, 'kırık json');
assert.equal(diagnostics.inspect().rootIsArray, false, 'unparseable storage does not throw');

/* Repair keeps what can be read and drops what cannot --------------------- */

storage.setItem(PROMPT_KEY, JSON.stringify([
  prompt('a'),
  prompt('a'),
  { id: 'broken', title: '', body: '' },
  prompt('b')
]));
storage.setItem(COLLECTION_KEY, JSON.stringify([
  { id: 'c1', name: 'Koleksiyon', description: '', color: 'default', promptIds: ['a', 'silinmiş'], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
]));
assert.equal(diagnostics.repair(), true, 'repair reports success');

const repairedPrompts = JSON.parse(storage.getItem(PROMPT_KEY));
assert.deepEqual(repairedPrompts.map((item) => item.id), ['a', 'b'], 'duplicate and unreadable records are dropped');
const repairedCollections = JSON.parse(storage.getItem(COLLECTION_KEY));
assert.deepEqual(repairedCollections[0].promptIds, ['a'], 'members now point at prompts that exist');
assert.equal(diagnostics.inspect().healthy, true, 'the library is healthy after a repair');

/* Nothing is lost when the store refuses to be written -------------------- */

const readable = JSON.stringify([prompt('a')]);
globalThis.localStorage = {
  ...createStorageStub({ [PROMPT_KEY]: readable }),
  setItem: () => { throw new Error('QuotaExceededError'); }
};
assert.equal(diagnostics.repair(), false, 'a failed write is reported as a failure');

globalThis.localStorage = createThrowingStorage(['getItem']);
assert.equal(diagnostics.inspect().rootIsArray, false, 'a blocked store does not throw');
assert.equal(diagnostics.repair(), false);

/* Bounds ------------------------------------------------------------------ */

const bounded = install({
  [PROMPT_KEY]: JSON.stringify(Array.from({ length: 400 }, (_, index) => prompt(`p-${index}`))),
  [COLLECTION_KEY]: JSON.stringify([{
    id: 'c1',
    name: 'Koleksiyon',
    description: '',
    color: 'default',
    promptIds: Array.from({ length: 400 }, (_, index) => `yok-${index}`),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }])
});
const large = diagnostics.inspect();
assert.ok(large.rawCount <= diagnostics.MAX_RECORDS * 2, 'the scan stays bounded');
assert.ok(large.orphans.length <= diagnostics.MAX_ORPHANS, 'the orphan list stays bounded');
diagnostics.repair();
assert.ok(JSON.parse(bounded.getItem(PROMPT_KEY)).length <= diagnostics.MAX_RECORDS, 'repair respects the library capacity');

console.log('prompt library diagnostics runtime: ok');
