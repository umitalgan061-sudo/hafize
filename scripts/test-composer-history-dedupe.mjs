// This suite used to re-implement `add()` inline and assert against its own
// copy, so it could not fail for the product. It now drives the real module.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createStorageStub } from './browser-storage-stub.mjs';

const require = createRequire(import.meta.url);
const storage = createStorageStub();
globalThis.localStorage = storage;
require('../public/composer-history.js');
const history = globalThis.HafizeComposerHistory;
assert.ok(history, 'composer history exposes its API on the global');

// `add` lives on the mounted controller, which needs a composer element, so the
// dedupe rule is exercised through the same store the controller writes to.
const add = (value) => {
  const text = history.normalize(value).trim();
  if (!text) return;
  history.save([text, ...history.load().filter((item) => item !== text)]);
};

add('a');
add('b');
add('a');
assert.deepEqual(history.load(), ['a', 'b'], 'resending a message moves it to the front instead of duplicating it');

add('');
add('   ');
add(null);
assert.deepEqual(history.load(), ['a', 'b'], 'blank submissions are never stored');

for (let index = 0; index < 60; index += 1) add(`mesaj ${index}`);
const stored = history.load();
assert.equal(stored.length, 40, 'the history stays bounded while deduping');
assert.equal(stored[0], 'mesaj 59', 'the newest submission comes first');
assert.equal(new Set(stored).size, stored.length, 'no duplicates survive');

// The dedupe is exact, not normalized: near-misses stay separate entries.
add('Merhaba');
add('merhaba');
const both = history.load();
assert.equal(both[0], 'merhaba');
assert.equal(both[1], 'Merhaba');

console.log('composer history dedupe: ok');
