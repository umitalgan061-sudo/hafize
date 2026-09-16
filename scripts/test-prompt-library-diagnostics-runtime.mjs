// Behavioural contract for the Prompt Library health panel.
//
// The source contract (test-prompt-library-diagnostics.mjs) only proves the
// module says the right words. This one runs it: a hostile storage blob goes
// in, a report comes out, and a repair leaves storage in a state the library's
// own loader accepts.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { createStorageStub, createThrowingStorage } from './browser-storage-stub.mjs';

const require = createRequire(import.meta.url);

const PROMPT_KEY = 'hafize.prompt-library.v1';
const COLLECTION_KEY = 'hafize.prompt-library.collections.v1';

const storage = createStorageStub();
globalThis.localStorage = storage;

// The panel reads both libraries through the window globals they install.
const library = require('../public/prompt-library.js');
globalThis.HafizePromptLibrary = library;
require('../public/prompt-library-collections.js');
const diagnostics = require('../public/prompt-library-diagnostics.js');

const prompt = (id, title = `İstem ${id}`) => ({
  id,
  title,
  body: `${title} gövdesi {{konu}}`,
  tags: [],
  favorite: false,
  useCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z'
});

const write = (prompts, collections) => {
  storage.setItem(PROMPT_KEY, typeof prompts === 'string' ? prompts : JSON.stringify(prompts));
  storage.setItem(COLLECTION_KEY, typeof collections === 'string' ? collections : JSON.stringify(collections));
};

/* A clean library reports healthy and offers nothing to repair ----------- */

write([prompt('a'), prompt('b')], [{ id: 'c1', name: 'Set', promptIds: ['a'], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }]);
let report = diagnostics.diagnose();
assert.equal(report.rawPrompts, 2);
assert.equal(report.healthyPrompts, 2);
assert.equal(report.brokenPrompts, 0);
assert.equal(report.duplicatePrompts, 0);
assert.equal(report.collections, 1);
assert.equal(report.orphanMembers, 0);
assert.equal(report.repairable, false);
assert.equal(diagnostics.describe(report), 'Kütüphane sağlıklı.');

/* Empty storage is healthy too, not an error ---------------------------- */

storage.removeItem(PROMPT_KEY);
storage.removeItem(COLLECTION_KEY);
report = diagnostics.diagnose();
assert.equal(report.rawPrompts, 0);
assert.equal(report.repairable, false);
assert.equal(report.promptRootValid, true);

/* Broken records, duplicate ids and orphan members are counted ---------- */

write(
  [prompt('a'), prompt('a'), { id: 'x' }, null, 'not-a-prompt', prompt('b')],
  [{ id: 'c1', name: 'Set', promptIds: ['a', 'gone-1', 'gone-2'], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }]
);
report = diagnostics.diagnose();
assert.equal(report.healthyPrompts, 2, 'the two well-formed prompts survive');
assert.equal(report.duplicatePrompts, 1, 'the repeated id is reported once');
assert.equal(report.brokenPrompts, 3, 'bodyless, null and string records are broken');
assert.equal(report.orphanMembers, 2);
assert.deepEqual(report.orphans.map((entry) => entry.promptId), ['gone-1', 'gone-2']);
assert.match(diagnostics.describe(report), /Sorun bulundu/);

/* A repair keeps what can be normalized and drops what cannot ----------- */

assert.equal(diagnostics.repair(), true);
const repaired = JSON.parse(storage.getItem(PROMPT_KEY));
assert.deepEqual(repaired.map((item) => item.id), ['a', 'b']);
const repairedCollections = JSON.parse(storage.getItem(COLLECTION_KEY));
assert.deepEqual(repairedCollections[0].promptIds, ['a'], 'members pointing at deleted prompts are pruned');
report = diagnostics.diagnose();
assert.equal(report.repairable, false, 'a repaired library reports healthy');

/* An unreadable root is reported, and the repair rebuilds from scratch --- */

write('{not json', '[]');
report = diagnostics.diagnose();
assert.equal(report.promptRootValid, false);
assert.equal(report.repairable, true);
assert.match(diagnostics.describe(report), /okunamıyor/);
assert.equal(diagnostics.repair(), true);
assert.deepEqual(JSON.parse(storage.getItem(PROMPT_KEY)), [], 'unreadable storage becomes an empty library, never a crash');

/* Orphan reporting is bounded ------------------------------------------ */

write(
  [prompt('a')],
  [{
    id: 'c1',
    name: 'Büyük set',
    promptIds: Array.from({ length: 400 }, (_, index) => `gone-${index}`),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }]
);
report = diagnostics.diagnose();
assert.ok(report.orphanMembers <= diagnostics.MAX_ORPHANS, 'the orphan list stays bounded');
assert.ok(report.orphanMembers > 0);

/* A storage that refuses writes fails the repair instead of half-applying */

globalThis.localStorage = createThrowingStorage(['setItem']);
assert.equal(diagnostics.repair(), false, 'a rejected write is reported, not swallowed');
globalThis.localStorage = storage;

/* Nothing leaves the device -------------------------------------------- */

assert.equal(typeof diagnostics.mount, 'function');
assert.ok(Object.isFrozen(diagnostics));

console.log('prompt diagnostics runtime: ok');
